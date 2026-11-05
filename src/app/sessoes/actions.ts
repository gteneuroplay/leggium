"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { encerrarSessaoPlenarioCompleto } from "@/app/painel/actions";
import { isProposicaoPautaManual, textoCompletoPautaManual } from "@/lib/pauta/pauta-manual";
import { setProposicaoAutoriaPoderExecutivo } from "@/lib/proposicao-poder-executivo";
import { proposicaoTipoEnumFromNome } from "@/lib/proposicao-tipo-map";
import { ensureDefaultProposicaoTiposForTenant } from "@/lib/bootstrap/default-proposicao-tipos";

export async function getSessoes() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return await prisma.sessao.findMany({
    where: { tenant_id: user.profile.tenant_id, deleted_at: null },
    include: {
      presencas: {
        select: {
          vereador_id: true,
          status: true,
        },
      },
      ordem_do_dia: {
        where: { deleted_at: null },
        select: {
          id: true,
          status_discussao: true,
          proposicao: {
            select: {
              status: true,
            },
          },
        },
      },
      votacoes: {
        where: { deleted_at: null },
        orderBy: { updated_at: "desc" },
        select: {
          id: true,
          proposicao_id: true,
          status: true,
          resultado_calculado: true,
          updated_at: true,
        },
      },
    },
    orderBy: { data_sessao: 'desc' }
  });
}

export async function getSessaoDetalhes(id: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const sessao = await prisma.sessao.findFirst({
    where: { id, tenant_id: user.profile.tenant_id, deleted_at: null },
  });

  const pauta = await prisma.ordemDoDia.findMany({
    where: { sessao_id: id, tenant_id: user.profile.tenant_id, deleted_at: null },
    include: {
      proposicao: {
        include: {
          autor: { select: { nome_parlamentar: true } },
        },
      },
    },
    orderBy: { ordem_sequencial: "asc" },
  });

  const presencas = await prisma.presenca.findMany({
    where: { sessao_id: id },
    include: {
      vereador: { select: { nome_parlamentar: true, foto_url: true } },
    },
  });

  return { sessao, pauta, presencas };
}

export async function upsertSessao(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const tenantId = user.profile.tenant_id;
  const { id, tipo, data_inicio, status, numero_sessao: numeroRaw, secao_legislativa: secaoRaw } = formData;
  // data_inicio deve vir como ISO com Z (instante UTC) após conversão no cliente; evita o servidor UTC
  // interpretar "YYYY-MM-DDTHH:mm" como 19h UTC em vez de 19h no fuso do utilizador.
  const data_sessao = new Date(data_inicio);

  const secaoTrim =
    secaoRaw != null && String(secaoRaw).trim() !== "" ? String(secaoRaw).trim().slice(0, 300) : null;

  const parseNumeroOpcional = (): number | undefined => {
    if (numeroRaw === undefined || numeroRaw === null || numeroRaw === "") return undefined;
    const n = typeof numeroRaw === "number" ? numeroRaw : parseInt(String(numeroRaw).trim(), 10);
    if (!Number.isFinite(n) || n < 1) return undefined;
    return n;
  };

  async function assertNumeroDisponivel(numero: number, excetoId?: string | null) {
    const dup = await prisma.sessao.findFirst({
      where: {
        tenant_id: tenantId,
        numero_sessao: numero,
        deleted_at: null,
        ...(excetoId ? { id: { not: excetoId } } : {}),
      },
      select: { id: true },
    });
    if (dup) {
      throw new Error("Já existe outra sessão com este número nesta câmara. Escolha outro número.");
    }
  }

  const dataToSave: any = {
    tenant_id: tenantId,
    tipo: tipo as any,
    data_sessao,
    status: (status || "AGENDADA") as any,
    updated_at: new Date(),
    ...(secaoTrim !== null ? { secao_legislativa: secaoTrim } : { secao_legislativa: null }),
  };

  if (id) {
    const parsedNum = parseNumeroOpcional();
    if (parsedNum !== undefined) {
      await assertNumeroDisponivel(parsedNum, id);
      dataToSave.numero_sessao = parsedNum;
    }
    await prisma.sessao.update({
      where: { id, tenant_id: tenantId },
      data: dataToSave,
    });
  } else {
    const lastSessao = await prisma.sessao.findFirst({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { numero_sessao: "desc" },
      select: { numero_sessao: true },
    });
    const sugerido = (lastSessao?.numero_sessao || 0) + 1;
    const parsedNum = parseNumeroOpcional();
    const numeroFinal = parsedNum ?? sugerido;
    await assertNumeroDisponivel(numeroFinal, null);

    const newSessao = await prisma.sessao.create({
      data: {
        ...dataToSave,
        id: crypto.randomUUID(),
        numero_sessao: numeroFinal,
      },
    });

    const vereadores = await prisma.vereador.findMany({
      where: {
        tenant_id: tenantId,
        status_mandato: true,
      },
      select: { id: true },
    });

    if (vereadores.length > 0) {
      await prisma.presenca.createMany({
        data: vereadores.map((v) => ({
          tenant_id: tenantId,
          sessao_id: newSessao.id,
          vereador_id: v.id,
          status: "AUSENTE",
        })),
      });
    }
  }

  revalidatePath("/sessoes");
  revalidatePath("/painel");
  revalidatePath("/");
  return { success: true };
}

export async function adicionarItemPauta(sessaoId: string, proposicaoId: string, ordem: number) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const tenantId = user.profile.tenant_id;

  const sessao = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!sessao) throw new Error("Sessão não encontrada.");

  const prop = await prisma.proposicao.findFirst({
    where: { id: proposicaoId, tenant_id: tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!prop) throw new Error("Proposição não encontrada.");

  await prisma.ordemDoDia.create({
    data: {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      proposicao_id: proposicaoId,
      ordem_sequencial: ordem,
    },
  });

  await prisma.proposicao.update({
    where: { id: proposicaoId },
    data: { status: "EM_PAUTA" },
  });

  revalidatePath("/sessoes");
  revalidatePath("/pautas");
  revalidatePath("/painel");
  return { success: true };
}

export type AdicionarItemPautaManualOpts = {
  /** Id em proposicao_tipos (Tipo de matéria). */
  tipo_id: string;
  autoria_poder_executivo?: boolean;
  /** Obrigatório quando não é Poder Executivo e o utilizador não é vereador (operador/admin escolhe o autor). */
  autor_id?: string | null;
};

/** Cria proposição sintética + linha na ordem do dia, sem passar por tramitação (votação/discussão no plenário). */
export async function adicionarItemPautaManual(
  sessaoId: string,
  ementa: string,
  complemento?: string | null,
  opts?: AdicionarItemPautaManualOpts | null,
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const tenantId = user.profile.tenant_id;
  const titulo = String(ementa ?? "").trim();
  if (titulo.length < 4) throw new Error("Informe um título (ementa) com pelo menos 4 caracteres.");

  const sessao = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!sessao) throw new Error("Sessão não encontrada.");

  const role = user.profile.role;
  const vId = user.profile.vereador?.id ?? null;
  const isPresidente = user.profile.vereador?.cargo_mesa === "PRESIDENTE";

  let finalExecutivo = !!opts?.autoria_poder_executivo;
  if (role === "VEREADOR" && !isPresidente) {
    finalExecutivo = false;
  }
  if (finalExecutivo && role === "VEREADOR" && !isPresidente) {
    throw new Error("Apenas o Presidente pode registrar matéria do Poder Executivo.");
  }

  let finalAutorId: string | null = null;
  if (role === "VEREADOR") {
    if (!vId) throw new Error("Perfil de vereador não vinculado.");
    if (finalExecutivo) {
      finalAutorId = null;
    } else {
      finalAutorId = vId;
    }
  } else {
    if (finalExecutivo) {
      finalAutorId = null;
    } else {
      const aid = typeof opts?.autor_id === "string" ? opts.autor_id.trim() : "";
      if (!aid) {
        throw new Error("Selecione o autor da matéria.");
      }
      const ok = await prisma.vereador.findFirst({
        where: {
          id: aid,
          tenant_id: tenantId,
          deleted_at: null,
          status_mandato: true,
        },
        select: { id: true },
      });
      if (!ok) throw new Error("Autor inválido ou vereador inativo.");
      finalAutorId = aid;
    }
  }

  const ano = new Date().getFullYear();
  const ultimaOrdem = await prisma.ordemDoDia.findFirst({
    where: { sessao_id: sessaoId, tenant_id: tenantId, deleted_at: null },
    orderBy: { ordem_sequencial: "desc" },
    select: { ordem_sequencial: true },
  });
  const proximaOrdem = (ultimaOrdem?.ordem_sequencial ?? 0) + 1;
  const propId = crypto.randomUUID();

  const tipoId = String(opts?.tipo_id ?? "").trim();
  if (!tipoId) throw new Error("Selecione o tipo de matéria.");

  await ensureDefaultProposicaoTiposForTenant(tenantId);

  const tipoRow = await prisma.proposicaoTipo.findFirst({
    where: { id: tipoId, tenant_id: tenantId },
    select: { id: true, nome: true },
  });
  if (!tipoRow) throw new Error("Tipo de matéria inválido.");

  const tipoEnum = proposicaoTipoEnumFromNome(tipoRow.nome);

  await prisma.$transaction(async (tx) => {
    await tx.proposicao.create({
      data: {
        id: propId,
        tenant_id: tenantId,
        ...(finalAutorId != null ? { autor_id: finalAutorId } : {}),
        tipo: tipoEnum as any,
        numero: null,
        ano,
        ementa: titulo,
        texto_completo: textoCompletoPautaManual(complemento ?? undefined),
        status: "EM_PAUTA",
        autoria_mesa: false,
      } as any,
    });
    await tx.ordemDoDia.create({
      data: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        proposicao_id: propId,
        ordem_sequencial: proximaOrdem,
        status_discussao: "AGUARDANDO",
      },
    });
  });

  await setProposicaoAutoriaPoderExecutivo(propId, finalExecutivo);

  revalidatePath("/sessoes");
  revalidatePath("/pautas");
  revalidatePath("/painel");
  return { success: true, proposicaoId: propId };
}

export async function removerItemPauta(itemId: string, proposicaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const tenantId = user.profile.tenant_id;

  const existing = await prisma.ordemDoDia.findFirst({
    where: { id: itemId, proposicao_id: proposicaoId, tenant_id: tenantId },
    include: { proposicao: { select: { texto_completo: true } } },
  });
  if (!existing) throw new Error("Item da pauta não encontrado.");

  const manual = isProposicaoPautaManual(existing.proposicao?.texto_completo);

  await prisma.ordemDoDia.delete({
    where: { id: itemId },
  });

  if (manual) {
    await prisma.proposicao.delete({
      where: { id: proposicaoId },
    });
  } else {
    await prisma.proposicao.update({
      where: { id: proposicaoId },
      data: { status: "PRONTO_PARA_PAUTA" },
    });
  }

  revalidatePath("/sessoes");
  revalidatePath("/pautas");
  revalidatePath("/painel");
  return { success: true };
}

export async function getProposicoesProntasParaPauta() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return await prisma.proposicao.findMany({
    where: {
      tenant_id: user.profile.tenant_id,
      status: "PRONTO_PARA_PAUTA"
    },
    include: {
      autor: { select: { nome_parlamentar: true } }
    },
    orderBy: { created_at: 'desc' }
  });
}

export async function registrarPresenca(sessaoId: string, vereadorId: string, status: 'PRESENTE' | 'AUSENTE' | 'FALTA_JUSTIFICADA') {
  await prisma.presenca.update({
    where: {
      sessao_id_vereador_id: {
        sessao_id: sessaoId,
        vereador_id: vereadorId
      }
    },
    data: {
      status: status as any,
      ...(status === "PRESENTE" ? { timestamp_checkin: new Date() } : {}),
    }
  });

  revalidatePath("/sessoes");
}

export async function deleteSessao(id: string) {
  await prisma.sessao.delete({
    where: { id }
  });
  revalidatePath("/sessoes");
}

export async function updateSessaoStatus(sessaoId: string, status: "AGENDADA" | "ABERTA" | "ENCERRADA") {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  if (status === "ENCERRADA") {
    await encerrarSessaoPlenarioCompleto(user.profile.tenant_id, sessaoId);
    return { success: true };
  }

  await prisma.sessao.update({
    where: { id: sessaoId, tenant_id: user.profile.tenant_id },
    data: {
      status: status as any,
      updated_at: new Date(),
    }
  });

  revalidatePath("/sessoes");
  revalidatePath("/painel");
  return { success: true };
}
