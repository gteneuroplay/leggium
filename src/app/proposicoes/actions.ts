"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { normalizeSetorNome } from "@/lib/bootstrap/default-setores";
import { ensureDefaultProposicaoTiposForTenant } from "@/lib/bootstrap/default-proposicao-tipos";
import { proposicaoTipoEnumFromNome } from "@/lib/proposicao-tipo-map";
import {
  getProposicaoAutoriaPoderExecutivo,
  mergeProposicoesComPoderExecutivo,
  setProposicaoAutoriaPoderExecutivo,
} from "@/lib/proposicao-poder-executivo";

export async function getProposicoes() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  const role = user.profile.role;
  const vId = user.profile.vereador?.id;

  // Se for ADMIN ou similar, vê tudo do tenant
  if (role !== 'VEREADOR') {
    return await prisma.proposicao.findMany({
      where: { tenant_id: user.profile.tenant_id },
      include: {
        autor: {
          select: { nome_parlamentar: true }
        },
        pareceres: true,
        votacoes: {
          where: { status: "ENCERRADA" },
          orderBy: { created_at: "desc" },
          take: 1,
          include: {
            votos: {
              include: {
                vereador: {
                  select: { nome_parlamentar: true }
                }
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  if (!vId) return [];

  const tenantId = user.profile.tenant_id;
  const include = {
    autor: {
      select: { nome_parlamentar: true },
    },
    pareceres: true,
    votacoes: {
      where: { status: "ENCERRADA" as const },
      orderBy: { created_at: "desc" as const },
      take: 1,
      include: {
        votos: {
          include: {
            vereador: {
              select: { nome_parlamentar: true },
            },
          },
        },
      },
    },
  };

  // Vereador: autor, mesa e (via SQL) Poder Executivo — sem `autoria_poder_executivo` no Prisma até `prisma generate`
  const base = await prisma.proposicao.findMany({
    where: {
      tenant_id: tenantId,
      OR: [{ autor_id: vId }, { autoria_mesa: true }],
    },
    include,
    orderBy: { created_at: "desc" },
  });

  return mergeProposicoesComPoderExecutivo(tenantId, base, (ids) =>
    prisma.proposicao.findMany({
      where: { id: { in: ids } },
      include,
    }),
  );
}

export async function getTiposProposicao() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  await ensureDefaultProposicaoTiposForTenant(user.profile.tenant_id);

  return await prisma.proposicaoTipo.findMany({
    where: { tenant_id: user.profile.tenant_id },
    orderBy: { nome: 'asc' }
  });
}

export async function upsertProposicao(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const {
    id,
    tipo_id,
    ementa,
    texto_integral,
    autor_id,
    status,
    autoria_mesa,
    autoria_poder_executivo,
    colaboradores,
  } = formData;

  const tipoData = await prisma.proposicaoTipo.findUnique({
    where: { id: tipo_id },
  });

  if (!tipoData) throw new Error("Tipo de proposição não encontrado.");

  const tipoEnum = proposicaoTipoEnumFromNome(tipoData.nome);

  let finalExecutivo = !!autoria_poder_executivo;
  let finalAutoriaMesa = !!(autoria_mesa && !finalExecutivo);

  const vId = user.profile.vereador?.id;
  let cargoMesa: string | null | undefined;
  if (user.profile.role === "VEREADOR" && vId) {
    const v = await prisma.vereador.findUnique({
      where: { id: vId },
      select: { cargo_mesa: true },
    });
    cargoMesa = v?.cargo_mesa ?? null;
  }
  const isPresidente = cargoMesa === "PRESIDENTE";

  if (finalAutoriaMesa && !isPresidente) {
    throw new Error("Apenas o Presidente pode criar proposições em nome da Mesa Diretora.");
  }

  if (finalExecutivo && user.profile.role === "VEREADOR" && !isPresidente) {
    throw new Error("Apenas o Presidente pode registrar proposição do Poder Executivo.");
  }

  let finalAutorId: string | null =
    typeof autor_id === "string" && autor_id.trim() !== "" ? autor_id.trim() : null;

  if (user.profile.role === "VEREADOR") {
    if (!vId) throw new Error("Perfil de vereador não vinculado");

    if (finalExecutivo) {
      finalAutorId = null;
    } else {
      finalAutorId = vId;
    }

    if (id) {
      const existingRaw = await prisma.proposicao.findUnique({ where: { id } });
      const existing = existingRaw as {
        autor_id: string | null;
        autoria_mesa: boolean | null;
        autoria_poder_executivo?: boolean | null;
      } | null;

      if (existing) {
        const isAuthor = existing.autor_id != null && existing.autor_id === vId;
        const isMesaPresidentFlow = !!existing.autoria_mesa && finalAutoriaMesa && isPresidente;
        const isPe =
          existing.autoria_poder_executivo ??
          (await getProposicaoAutoriaPoderExecutivo(id));
        const isPresidentEditingExecutivo = isPe && isPresidente;

        if (!isAuthor && !isMesaPresidentFlow && !isPresidentEditingExecutivo) {
          throw new Error("Você não tem permissão para editar esta proposição.");
        }
      }
    }
  } else {
    if (finalExecutivo) {
      finalAutorId = null;
    }
    if (!finalExecutivo && !finalAutoriaMesa && !finalAutorId) {
      throw new Error("Selecione o autor da proposição.");
    }
  }

  const dataToSave = {
    tenant_id: user.profile.tenant_id,
    tipo: tipoEnum as any,
    ementa,
    texto_completo: texto_integral,
    autor_id: finalAutorId,
    autoria_mesa: finalAutoriaMesa,
    status: (status || "PROTOCOLADO") as any,
    updated_at: new Date(),
  };

  let result;
  if (id) {
    result = await prisma.proposicao.update({
      where: { id },
      data: dataToSave as any,
    });
    await setProposicaoAutoriaPoderExecutivo(id, finalExecutivo);
  } else {
    const currentYear = new Date().getFullYear();
    result = await prisma.$transaction(async (tx) => {
      const lockKey = `${user.profile.tenant_id}:${tipoEnum}:${currentYear}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const tenant = await tx.tenant.findUnique({
        where: { id: user.profile.tenant_id },
        select: { settings: true }
      });

      const settings = (tenant?.settings || {}) as Record<string, any>;
      const byYear = (settings.proposicao_numeracao || {}) as Record<string, Record<string, number>>;
      const yearKey = String(currentYear);
      const configuredNext = Number(byYear?.[yearKey]?.[tipoEnum]);

      let novoNumero: number;
      if (Number.isFinite(configuredNext) && configuredNext > 0) {
        novoNumero = Math.floor(configuredNext);
      } else {
        const tenantId = user.profile.tenant_id;
        const tipoStr = String(tipoEnum);
        const ultimos = await tx.$queryRaw<{ numero: number | null }[]>`
          SELECT numero FROM proposicoes
          WHERE tenant_id = ${tenantId}::uuid
            AND tipo::text = ${tipoStr}
            AND ano = ${currentYear}
            AND deleted_at IS NULL
            AND numero IS NOT NULL
          ORDER BY numero DESC
          LIMIT 1
        `;
        const ultimo = ultimos[0]?.numero;
        novoNumero = ultimo != null && ultimo > 0 ? ultimo + 1 : 1;
      }

      const created = await tx.proposicao.create({
        data: {
          ...dataToSave,
          id: crypto.randomUUID(),
          numero: novoNumero,
          ano: currentYear,
        } as any,
      });

      if (Number.isFinite(configuredNext) && configuredNext > 0) {
        const nextSettings = {
          ...settings,
          proposicao_numeracao: {
            ...byYear,
            [yearKey]: {
              ...(byYear[yearKey] || {}),
              [tipoEnum]: novoNumero + 1
            }
          }
        };
        await tx.tenant.update({
          where: { id: user.profile.tenant_id },
          data: { settings: nextSettings, updated_at: new Date() }
        });
      }

      return created;
    });
    await setProposicaoAutoriaPoderExecutivo(result.id, finalExecutivo);
  }

  if (result.id && colaboradores) {
    // Nota: colaboradores precisam de uma tabela de relacionamento no Prisma se quisermos manter
    // Por enquanto, apenas revalidamos
  }

  revalidatePath("/proposicoes");
  
  const saved = await prisma.proposicao.findUnique({
    where: { id: result.id },
    include: {
      autor: { select: { nome_parlamentar: true } },
      pareceres: true
    }
  });

  if (!saved) throw new Error("Erro ao recuperar proposição salva");
  return saved;
}

// Action para convidar colaborador
export async function inviteColaborador(proposicaoId: string, vereadorId: string) {
  // Nota: proposicao_colaboradores ainda não tem modelo no Prisma, ignorando por enquanto
  return { success: true };
}

export async function respondColaboracao(colabId: string, status: 'ACEITO' | 'RECUSADO') {
  // Nota: proposicao_colaboradores ainda não tem modelo no Prisma, ignorando por enquanto
  return { success: true };
}

export async function deleteProposicao(id: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  await prisma.proposicao.delete({
    where: { 
      id,
      tenant_id: user.profile.tenant_id
    }
  });

  revalidatePath("/proposicoes");
  return { success: true };
}

export async function getDashboardStats() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return null;

  const role = user.profile.role;
  const vId = user.profile.vereador?.id;

  if (role === 'VEREADOR' && vId) {
    const [total, emComissoes, emPauta] = await Promise.all([
      prisma.proposicao.count({ where: { autor_id: vId } }),
      prisma.proposicao.count({ where: { autor_id: vId, status: 'EM_TRAMITACAO' } }),
      prisma.proposicao.count({ where: { autor_id: vId, status: 'EM_PAUTA' } })
    ]);

    return {
      type: 'VEREADOR',
      stats: [
        { name: "Minhas Proposições", value: total, key: 'proposicoes' },
        { name: "Nas Comissões", value: emComissoes, key: 'comissoes' },
        { name: "Em Pauta (Hoje)", value: emPauta, key: 'pauta' },
        { name: "Convites Pendentes", value: 0, key: 'convites' },
      ],
      convites: []
    };
  }

  return { type: 'ADMIN' };
}

export async function updateProposicaoPdfUrl(proposicaoId: string, pdfUrl: string) {
  await prisma.proposicao.update({
    where: { id: proposicaoId },
    data: { pdf_url: pdfUrl }
  });
  
  revalidatePath("/proposicoes");
  return { success: true };
}

/** Dados frescos para pré-visualização (inclui pdf_url completo do banco). */
export async function getProposicaoParaPreview(proposicaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const row = await prisma.proposicao.findFirst({
    where: {
      id: proposicaoId,
      tenant_id: user.profile.tenant_id,
      deleted_at: null,
    },
    select: {
      id: true,
      pdf_url: true,
      texto_completo: true,
      ementa: true,
      numero: true,
      ano: true,
      tipo: true,
      created_at: true,
      autoria_mesa: true,
      autor_id: true,
      autor: { select: { nome_parlamentar: true } },
    },
  });

  if (!row) throw new Error("Proposição não encontrada");

  const autoria_poder_executivo = await getProposicaoAutoriaPoderExecutivo(proposicaoId);
  return { ...row, autoria_poder_executivo };
}

// --- NOVAS ACTIONS PARA TRAMITAÇÃO E PARECERES ---

export async function getTramitacoes(proposicaoId: string) {
  return await prisma.tramitacao.findMany({
    where: { proposicao_id: proposicaoId },
    include: {
      usuario: { select: { nome: true } },
      origem_setor: { select: { nome: true, sigla: true } },
      destino_setor: { select: { nome: true, sigla: true } }
    },
    orderBy: { created_at: 'asc' }
  });
}

export async function registrarTramitacao(data: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  // Busca setor de destino padrão (ex: Secretaria ou Jurídico) se não informado
  // Para fins de simplificação, usaremos o setor_id do usuário se não informado destino
  const destinoId = data.destino_setor_id || user.profile.setor_id;
  if (!destinoId) {
    throw new Error("Setor de destino não identificado. Por favor, verifique se o seu perfil possui um setor vinculado.");
  }

  await prisma.tramitacao.create({
    data: {
      tenant_id: user.profile.tenant_id,
      proposicao_id: data.proposicao_id,
      origem_setor_id: data.origem_setor_id || user.profile.setor_id,
      destino_setor_id: destinoId,
      acao: data.acao as any,
      despacho_texto: data.despacho_texto,
      usuario_id: user.profile.id,
      data_tramite: new Date()
    }
  });

  revalidatePath("/proposicoes");
  revalidatePath("/tramitacao");
  return { success: true };
}

export async function getPareceres(proposicaoId: string) {
  return await prisma.parecer.findMany({
    where: { proposicao_id: proposicaoId },
    include: {
      autor: { select: { nome: true } },
      comissao: { select: { nome: true, sigla: true } }
    },
    orderBy: { created_at: 'desc' }
  });
}

export async function registrarParecer(data: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const isDev = user.profile.email === 'bergzxgs@gmail.com' || user.profile.role === 'ADMIN_MASTER';
  const setorNome = normalizeSetorNome(user.profile?.setor?.nome || "");
  const isJuridico = user.profile?.role === "JURIDICO" || setorNome === "JURIDICO";
  const isComissao = setorNome === "COMISSAO";
  const isAdministrador = user.profile?.role === "ADMIN_MASTER" || user.profile?.role === "DEV" || setorNome === "ADMINISTRADOR";
  const vereadorId = user.profile?.vereador?.id || null;

  if (isJuridico && data.tipo_parecer !== "JURIDICO") {
    throw new Error("Usuários do setor Jurídico só podem registrar parecer do tipo Jurídico.");
  }
  if (isComissao && data.tipo_parecer !== "COMISSAO") {
    throw new Error("Usuários do setor Comissão só podem registrar parecer do tipo Comissão.");
  }

  const parecerJuridicoComComissao = await prisma.parecer.findFirst({
    where: {
      tenant_id: user.profile.tenant_id,
      proposicao_id: data.proposicao_id,
      tipo_parecer: "JURIDICO",
      comissao_id: { not: null }
    },
    orderBy: { created_at: "desc" },
    select: { comissao_id: true }
  });

  let comissaoDoParecer = data.comissao_id || null;
  if (data.tipo_parecer === "JURIDICO") {
    if (!isAdministrador && comissaoDoParecer) {
      throw new Error("A comissão de destino deve ser definida pelo Administrador.");
    }
  }

  if (data.tipo_parecer === "COMISSAO") {
    const existeParecerJuridico = await prisma.parecer.findFirst({
      where: {
        tenant_id: user.profile.tenant_id,
        proposicao_id: data.proposicao_id,
        tipo_parecer: "JURIDICO"
      },
      select: { id: true }
    });
    if (!existeParecerJuridico) {
      throw new Error("A proposição ainda não recebeu parecer jurídico.");
    }

    comissaoDoParecer = comissaoDoParecer || parecerJuridicoComComissao?.comissao_id || null;
    if (!comissaoDoParecer) {
      throw new Error("Fluxo pendente: após o Jurídico, o Administrador deve definir a comissão antes do parecer de comissão.");
    }

    const comissaoRef = await prisma.comissao.findFirst({
      where: {
        id: comissaoDoParecer,
        tenant_id: user.profile.tenant_id,
        deleted_at: null
      },
      select: {
        id: true,
        presidente_id: true
      }
    });

    if (!comissaoRef) {
      throw new Error("A comissão definida para este parecer não foi encontrada.");
    }

    const isPresidenteDaComissao = Boolean(vereadorId && comissaoRef.presidente_id === vereadorId);
    if (!isAdministrador && !isPresidenteDaComissao) {
      throw new Error("Apenas o presidente da comissão definida pode registrar o parecer da comissão.");
    }
  }

  const setoresTenant = await prisma.setor.findMany({
    where: {
      tenant_id: user.profile.tenant_id,
      deleted_at: null
    },
    select: { id: true, nome: true }
  });

  const setorComissao = setoresTenant.find((s) => normalizeSetorNome(s.nome) === "COMISSAO");
  const setorAdministrador = setoresTenant.find((s) => normalizeSetorNome(s.nome) === "ADMINISTRADOR");

  const fluxoComissao = data.tipo_parecer === "COMISSAO";

  // Fluxo automático:
  // Jurídico -> Administrador (define comissão)
  // Comissão (presidente) -> Administrador
  let destinoSetorId = data.proximo_setor_id || user.profile.setor_id || null;
  if (isJuridico || fluxoComissao) {
    destinoSetorId = setorAdministrador?.id || destinoSetorId;
  } else if (!isAdministrador) {
    destinoSetorId = user.profile.setor_id || destinoSetorId;
  }
  if (!destinoSetorId) {
    throw new Error("Setor de destino não identificado para registrar a tramitação do parecer.");
  }

  const origemSetorId =
    user.profile.setor_id ||
    (fluxoComissao ? setorComissao?.id : null) ||
    destinoSetorId;
  if (!origemSetorId) {
    throw new Error("Setor de origem não identificado para registrar a tramitação do parecer.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.parecer.create({
      data: {
        tenant_id: user.profile.tenant_id,
        proposicao_id: data.proposicao_id,
        tipo_parecer: data.tipo_parecer,
        comissao_id: comissaoDoParecer,
        texto_parecer: data.texto_parecer,
        conclusao: data.conclusao,
        autor_parecer_id: (isDev && data.autor_id) ? data.autor_id : user.profile.id
      }
    });

    await tx.tramitacao.create({
      data: {
        tenant_id: user.profile.tenant_id,
        proposicao_id: data.proposicao_id,
        origem_setor_id: origemSetorId,
        destino_setor_id: destinoSetorId,
        acao: data.conclusao === "FAVORAVEL" ? "PARECER_FAVORAVEL" : "PARECER_CONTRARIO",
        despacho_texto: `Parecer ${data.tipo_parecer} registrado: ${data.conclusao}. Encaminhado para próxima etapa.`,
        usuario_id: user.profile.id,
        data_tramite: new Date()
      }
    });

    await tx.proposicao.update({
      where: { id: data.proposicao_id },
      data: { status: "AGUARDANDO_PARECER" }
    });
  });

  revalidatePath("/proposicoes");
  revalidatePath("/tramitacao");
  return { success: true };
}

export async function adminDefinirComissaoParaProposicao(proposicaoId: string, comissaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const setorNome = normalizeSetorNome(user.profile?.setor?.nome || "");
  const isAdministrador =
    user.profile?.role === "ADMIN_MASTER" ||
    user.profile?.role === "DEV" ||
    setorNome === "ADMINISTRADOR";
  if (!isAdministrador) {
    throw new Error("Apenas o Administrador pode definir a comissão da proposição.");
  }

  const parecerJuridico = await prisma.parecer.findFirst({
    where: {
      tenant_id: user.profile.tenant_id,
      proposicao_id: proposicaoId,
      tipo_parecer: "JURIDICO"
    },
    orderBy: { created_at: "desc" },
    select: { id: true }
  });
  if (!parecerJuridico) {
    throw new Error("É necessário existir parecer jurídico antes de definir a comissão.");
  }

  const comissao = await prisma.comissao.findFirst({
    where: {
      id: comissaoId,
      tenant_id: user.profile.tenant_id,
      deleted_at: null
    },
    select: { id: true, nome: true, sigla: true }
  });
  if (!comissao) {
    throw new Error("Comissão inválida para este tenant.");
  }

  await prisma.parecer.update({
    where: { id: parecerJuridico.id },
    data: { comissao_id: comissao.id }
  });

  const setorComissao = await prisma.setor.findFirst({
    where: {
      tenant_id: user.profile.tenant_id,
      deleted_at: null
    },
    select: { id: true, nome: true }
  });
  const destinoComissaoId = (await prisma.setor.findMany({
    where: { tenant_id: user.profile.tenant_id, deleted_at: null },
    select: { id: true, nome: true }
  })).find((s) => normalizeSetorNome(s.nome) === "COMISSAO")?.id || setorComissao?.id;

  if (!destinoComissaoId) {
    throw new Error("Setor Comissão não encontrado para encaminhamento.");
  }

  await prisma.tramitacao.create({
    data: {
      tenant_id: user.profile.tenant_id,
      proposicao_id: proposicaoId,
      origem_setor_id: user.profile.setor_id || destinoComissaoId,
      destino_setor_id: destinoComissaoId,
      acao: "ENCAMINHADO",
      despacho_texto: `Administrador definiu a comissão ${comissao.sigla} - ${comissao.nome} para emissão do parecer.`,
      usuario_id: user.profile.id,
      data_tramite: new Date()
    }
  });

  await prisma.proposicao.update({
    where: { id: proposicaoId, tenant_id: user.profile.tenant_id },
    data: { status: "AGUARDANDO_PARECER" }
  });

  revalidatePath("/tramitacao");
  revalidatePath("/proposicoes");
  return { success: true };
}

export async function getComissoes() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return await prisma.comissao.findMany({
    where: { tenant_id: user.profile.tenant_id },
    orderBy: { nome: 'asc' }
  });
}

export async function updateProposicaoStatus(id: string, status: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const setorNome = normalizeSetorNome(user.profile?.setor?.nome || "");
  const isAdministrador = user.profile?.role === "ADMIN_MASTER" || user.profile?.role === "DEV" || setorNome === "ADMINISTRADOR";

  if (status === "PRONTO_PARA_PAUTA" && !isAdministrador) {
    throw new Error("Apenas o Administrador pode preparar a proposição para pauta.");
  }

  await prisma.proposicao.update({
    where: { 
      id,
      tenant_id: user.profile.tenant_id
    },
    data: { status: status as any }
  });
  
  revalidatePath("/proposicoes");
  revalidatePath("/tramitacao");
  return { success: true };
}

export async function adminTramitarDiretoParaPauta(proposicaoId: string, despacho?: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const setorNome = normalizeSetorNome(user.profile?.setor?.nome || "");
  const isAdministrador =
    user.profile?.role === "ADMIN_MASTER" ||
    user.profile?.role === "DEV" ||
    setorNome === "ADMINISTRADOR";

  if (!isAdministrador) {
    throw new Error("Apenas o Administrador pode tramitar diretamente para pauta.");
  }

  const setoresTenant = await prisma.setor.findMany({
    where: { tenant_id: user.profile.tenant_id, deleted_at: null },
    select: { id: true, nome: true }
  });
  const setorAdministrador = setoresTenant.find((s) => normalizeSetorNome(s.nome) === "ADMINISTRADOR");
  const destinoSetorId = setorAdministrador?.id || user.profile.setor_id;
  if (!destinoSetorId) {
    throw new Error("Setor administrador não encontrado para registrar tramitação.");
  }

  await prisma.tramitacao.create({
    data: {
      tenant_id: user.profile.tenant_id,
      proposicao_id: proposicaoId,
      origem_setor_id: user.profile.setor_id || destinoSetorId,
      destino_setor_id: destinoSetorId,
      acao: "ENCAMINHADO",
      despacho_texto:
        despacho?.trim() ||
        "Proposição tramitada diretamente para pauta por decisão administrativa.",
      usuario_id: user.profile.id,
      data_tramite: new Date()
    }
  });

  await prisma.proposicao.update({
    where: {
      id: proposicaoId,
      tenant_id: user.profile.tenant_id
    },
    data: {
      status: "PRONTO_PARA_PAUTA"
    }
  });

  revalidatePath("/proposicoes");
  revalidatePath("/tramitacao");
  revalidatePath("/sessoes");
  return { success: true };
}

export async function getNotasProposicao(proposicaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const notas = await prisma.$queryRaw<Array<{
    id: string;
    conteudo: string;
    created_at: Date;
    autor_nome: string | null;
    autor_id: string;
  }>>`
    SELECT n.id, n.conteudo, n.created_at, u.nome AS autor_nome, n.autor_id
    FROM proposicao_notas n
    LEFT JOIN users u ON u.id = n.autor_id
    WHERE n.tenant_id = ${user.profile.tenant_id}::uuid
      AND n.proposicao_id = ${proposicaoId}::uuid
      AND n.deleted_at IS NULL
    ORDER BY n.created_at ASC
  `;

  const lastRead = await prisma.$queryRaw<Array<{ last_read_at: Date }>>`
    SELECT last_read_at
    FROM proposicao_notas_leitura
    WHERE user_id = ${user.profile.id}::uuid
      AND proposicao_id = ${proposicaoId}::uuid
    LIMIT 1
  `;

  const total = notas.length;
  const unread = notas.filter((n) => {
    if (n.autor_id === user.profile.id) return false;
    if (!lastRead[0]?.last_read_at) return true;
    return new Date(n.created_at) > new Date(lastRead[0].last_read_at);
  }).length;

  return { notas, total, unread };
}

export async function adicionarNotaProposicao(data: { proposicao_id: string; conteudo: string }) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const conteudo = (data.conteudo || "").trim();
  if (!conteudo) throw new Error("O conteúdo da nota é obrigatório.");

  await prisma.$executeRaw`
    INSERT INTO proposicao_notas (tenant_id, proposicao_id, autor_id, conteudo)
    VALUES (${user.profile.tenant_id}::uuid, ${data.proposicao_id}::uuid, ${user.profile.id}::uuid, ${conteudo})
  `;

  await prisma.$executeRaw`
    INSERT INTO proposicao_notas_leitura (user_id, proposicao_id, last_read_at)
    VALUES (${user.profile.id}::uuid, ${data.proposicao_id}::uuid, now())
    ON CONFLICT (user_id, proposicao_id)
    DO UPDATE SET last_read_at = EXCLUDED.last_read_at
  `;

  revalidatePath("/tramitacao");
  return { success: true };
}

export async function marcarNotasComoLidas(proposicaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  await prisma.$executeRaw`
    INSERT INTO proposicao_notas_leitura (user_id, proposicao_id, last_read_at)
    VALUES (${user.profile.id}::uuid, ${proposicaoId}::uuid, now())
    ON CONFLICT (user_id, proposicao_id)
    DO UPDATE SET last_read_at = EXCLUDED.last_read_at
  `;

  revalidatePath("/tramitacao");
  return { success: true };
}

export async function getNotasResumoTramitacao(proposicaoIds: string[]) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const resumo: Record<string, { total: number; unread: number }> = {};

  for (const proposicaoId of proposicaoIds) {
    const notas = await prisma.$queryRaw<Array<{
      autor_id: string;
      created_at: Date;
    }>>`
      SELECT autor_id, created_at
      FROM proposicao_notas
      WHERE tenant_id = ${user.profile.tenant_id}::uuid
        AND proposicao_id = ${proposicaoId}::uuid
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    const lastRead = await prisma.$queryRaw<Array<{ last_read_at: Date }>>`
      SELECT last_read_at
      FROM proposicao_notas_leitura
      WHERE user_id = ${user.profile.id}::uuid
        AND proposicao_id = ${proposicaoId}::uuid
      LIMIT 1
    `;

    const total = notas.length;
    const unread = notas.filter((n) => {
      if (n.autor_id === user.profile.id) return false;
      if (!lastRead[0]?.last_read_at) return true;
      return new Date(n.created_at) > new Date(lastRead[0].last_read_at);
    }).length;

    resumo[proposicaoId] = { total, unread };
  }

  return resumo;
}
