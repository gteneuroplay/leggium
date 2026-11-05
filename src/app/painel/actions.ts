"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { Prisma, PresencaTipo, ProposicaoStatus, SessaoStatus, VotoTipo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pgPublicColumnExists } from "@/lib/db/pg-column-exists";
import { pickOradorEmFala, isOradorPresidenteMesa } from "@/lib/painel/orador-display";
import { resolveConclusaoFalaAtual } from "@/lib/painel/concluir-fala-state";
import { isOptimisticPainelSolicitacaoId } from "@/lib/painel/solicitacao-ids";
import { emitSessionEvent } from "@/lib/realtime/sessions";
import { assertRateLimit } from "@/lib/realtime/rate-limit";
import {
  signPresidenteMesaToken,
  verifyPresidenteMesaToken,
} from "@/lib/painel/presidente-mesa-token";

type PerfilComVereador = {
  id: string;
  tenant_id: string;
  vereador_id?: string | null;
  vereador?: { id: string } | null;
};

/** ID do parlamentar ligado ao utilizador (`vereador`, `vereador_id` ou `vereadores.user_id`). */
async function resolveVereadorIdDoUsuarioLogado(profile: PerfilComVereador): Promise<string | null> {
  if (profile.vereador?.id) return profile.vereador.id;
  if (profile.vereador_id) return profile.vereador_id;
  const row = await prisma.vereador.findFirst({
    where: {
      user_id: profile.id,
      tenant_id: profile.tenant_id,
      deleted_at: null,
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** Lista `solicitacoes_palavra` e junta vereador/visitante. Sem migração (`visitante_id`), ignora orador externo na fila. */
async function solicitacoesPalavraListComRelacoes(sessaoId: string, tenantId: string) {
  type Row = {
    id: string;
    tenant_id: string;
    sessao_id: string;
    vereador_id: string | null;
    visitante_id: string | null;
    tipo: string;
    status: string;
    created_at: Date;
  };

  const hasVisitanteFk = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");
  const rows = hasVisitanteFk
    ? await prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT id, tenant_id, sessao_id, vereador_id, visitante_id, tipo, status, created_at
        FROM solicitacoes_palavra
        WHERE sessao_id = ${sessaoId}::uuid AND tenant_id = ${tenantId}::uuid
        ORDER BY created_at ASC
      `)
    : (
        await prisma.$queryRaw<
          Omit<Row, "visitante_id">[]
        >(Prisma.sql`
        SELECT id, tenant_id, sessao_id, vereador_id, tipo, status, created_at
        FROM solicitacoes_palavra
        WHERE sessao_id = ${sessaoId}::uuid AND tenant_id = ${tenantId}::uuid
        ORDER BY created_at ASC
      `)
      ).map((r) => ({ ...r, visitante_id: null as string | null }));

  const vIds = [...new Set(rows.map((r) => r.vereador_id).filter((x): x is string => Boolean(x)))];
  const vtIds = [...new Set(rows.map((r) => r.visitante_id).filter((x): x is string => Boolean(x)))];

  const [vereadoresL, visitantesL] = await Promise.all([
    vIds.length ? prisma.vereador.findMany({ where: { id: { in: vIds } } }) : Promise.resolve([]),
    vtIds.length ? prisma.visitante.findMany({ where: { id: { in: vtIds } } }) : Promise.resolve([]),
  ]);

  const vm = new Map(vereadoresL.map((v) => [v.id, v]));
  const vtm = new Map(visitantesL.map((v) => [v.id, v]));

  return rows.map((r) => ({
    ...r,
    vereador: r.vereador_id ? vm.get(r.vereador_id) ?? null : null,
    visitante: r.visitante_id ? vtm.get(r.visitante_id) ?? null : null,
  }));
}

type PrismaExecLike = {
  solicitacaoPalavra: typeof prisma.solicitacaoPalavra;
  $executeRaw: typeof prisma.$executeRaw;
  $queryRaw: typeof prisma.$queryRaw;
};

/** INSERT por vereador: sem coluna `visitante_id` na BD, evita Prisma (que inclui a coluna no SQL). */
async function insertSolicitacaoPalavraVereadorCore(
  exec: PrismaExecLike,
  hasVisitanteCol: boolean,
  data: {
    tenant_id: string;
    sessao_id: string;
    vereador_id: string;
    tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM";
    status?: string;
  },
): Promise<string> {
  const status = data.status ?? "PENDENTE";
  if (hasVisitanteCol) {
    const row = await exec.solicitacaoPalavra.create({
      data: {
        tenant_id: data.tenant_id,
        sessao_id: data.sessao_id,
        vereador_id: data.vereador_id,
        visitante_id: null,
        tipo: data.tipo,
        status,
      },
      select: { id: true },
    });
    return row.id;
  }
  const inserted = await exec.$queryRaw<{ id: string }[]>(Prisma.sql`
    INSERT INTO solicitacoes_palavra (tenant_id, sessao_id, vereador_id, tipo, status)
    VALUES (
      ${data.tenant_id}::uuid,
      ${data.sessao_id}::uuid,
      ${data.vereador_id}::uuid,
      ${data.tipo},
      ${status}
    )
    RETURNING id
  `);
  return inserted[0]!.id;
}

function aplicarTimerOratoriaSemLimite(timer: OratoriaTimerInternalState, solicitacaoId: string) {
  timer.speakerSemLimiteTempo = true;
  timer.speakerSolicitacaoId = solicitacaoId;
  timer.durationSec = 0;
  timer.remainingSec = 0;
  timer.isRunning = false;
  timer.startedAtMs = null;
  timer.pausedRemainingBySolicitacaoId = {};
  timer.pausedSpeakerStack = [];
}

/** Carrega solicitação + vereador para atender; sem `visitante_id` na BD evita `findFirst` com `include` do Prisma. */
type SolicitacaoPalavraAtenderShape = {
  id: string;
  sessao_id: string;
  tipo: string;
  vereador_id: string | null;
  visitante_id: string | null;
  vereador: { id: string; cargo_mesa: string | null } | null;
  visitante: { id: string } | null;
};

async function loadSolicitacaoPalavraParaAtender(
  tenantId: string,
  solicitacaoId: string,
  hasVisitanteCol: boolean,
): Promise<SolicitacaoPalavraAtenderShape | null> {
  if (hasVisitanteCol) {
    const row = await prisma.solicitacaoPalavra.findFirst({
      where: { id: solicitacaoId, tenant_id: tenantId },
      include: {
        vereador: { select: { cargo_mesa: true, id: true } },
        visitante: { select: { id: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      sessao_id: row.sessao_id,
      tipo: row.tipo,
      vereador_id: row.vereador_id,
      visitante_id: row.visitante_id,
      vereador: row.vereador,
      visitante: row.visitante,
    };
  }
  type RawRow = {
    id: string;
    sessao_id: string;
    vereador_id: string | null;
    tipo: string;
    v_id: string | null;
    v_cargo_mesa: string | null;
  };
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT
      sp.id,
      sp.sessao_id,
      sp.vereador_id,
      sp.tipo,
      v.id AS v_id,
      v.cargo_mesa AS v_cargo_mesa
    FROM solicitacoes_palavra sp
    LEFT JOIN vereadores v ON v.id = sp.vereador_id AND v.deleted_at IS NULL
    WHERE sp.id = ${solicitacaoId}::uuid AND sp.tenant_id = ${tenantId}::uuid
    LIMIT 1
  `);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    sessao_id: r.sessao_id,
    tipo: r.tipo,
    vereador_id: r.vereador_id,
    visitante_id: null,
    vereador: r.v_id ? { id: r.v_id, cargo_mesa: r.v_cargo_mesa } : null,
    visitante: null,
  };
}

/** UPDATE de `status` por id: sem coluna `visitante_id`, evita Prisma (pode tocar nessa coluna). */
async function updateSolicitacaoPalavraStatusPorIdTx(
  exec: PrismaExecLike,
  hasVisitanteCol: boolean,
  solicitacaoId: string,
  status: string,
) {
  if (hasVisitanteCol) {
    await exec.solicitacaoPalavra.update({
      where: { id: solicitacaoId },
      data: { status },
    });
  } else {
    await exec.$executeRaw(Prisma.sql`
      UPDATE solicitacoes_palavra SET status = ${status}
      WHERE id = ${solicitacaoId}::uuid
    `);
  }
}

async function updateManySolicitacaoEmFalaAtendidoExcetoTx(
  exec: PrismaExecLike,
  hasVisitanteCol: boolean,
  tenantId: string,
  sessaoId: string,
  excetoSolicitacaoId: string,
) {
  if (hasVisitanteCol) {
    await exec.solicitacaoPalavra.updateMany({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        status: "EM_FALA",
        id: { not: excetoSolicitacaoId },
      },
      data: { status: "ATENDIDO" },
    });
  } else {
    await exec.$executeRaw(Prisma.sql`
      UPDATE solicitacoes_palavra SET status = 'ATENDIDO'
      WHERE tenant_id = ${tenantId}::uuid
        AND sessao_id = ${sessaoId}::uuid
        AND status = 'EM_FALA'
        AND id <> ${excetoSolicitacaoId}::uuid
    `);
  }
}

async function updateManySolicitacaoEmFalaAtendidoTodosTx(
  exec: PrismaExecLike,
  hasVisitanteCol: boolean,
  tenantId: string,
  sessaoId: string,
) {
  if (hasVisitanteCol) {
    await exec.solicitacaoPalavra.updateMany({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        status: "EM_FALA",
      },
      data: { status: "ATENDIDO" },
    });
  } else {
    await exec.$executeRaw(Prisma.sql`
      UPDATE solicitacoes_palavra SET status = 'ATENDIDO'
      WHERE tenant_id = ${tenantId}::uuid AND sessao_id = ${sessaoId}::uuid AND status = 'EM_FALA'
    `);
  }
}

async function updateManySolicitacaoPendenteOuEmFalaAtendidoTx(
  exec: PrismaExecLike,
  hasVisitanteCol: boolean,
  tenantId: string,
  sessaoId: string,
) {
  if (hasVisitanteCol) {
    await exec.solicitacaoPalavra.updateMany({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        status: { in: ["PENDENTE", "EM_FALA"] },
      },
      data: { status: "ATENDIDO" },
    });
  } else {
    await exec.$executeRaw(Prisma.sql`
      UPDATE solicitacoes_palavra SET status = 'ATENDIDO'
      WHERE tenant_id = ${tenantId}::uuid
        AND sessao_id = ${sessaoId}::uuid
        AND status IN ('PENDENTE', 'EM_FALA')
    `);
  }
}

type VisitanteTribunaPainel = {
  id: string;
  nome_completo: string;
  representacao: string | null;
  foto_url: string | null;
  motivo_visita: string;
};

/** Oradores liberados para tribuna; sem colunas da migração devolve lista vazia. */
async function visitantesTribunaParaPainel(tenantId: string): Promise<VisitanteTribunaPainel[]> {
  const hasDisp = await pgPublicColumnExists("visitantes", "disponivel_tribuna");
  if (!hasDisp) return [];
  const hasFoto = await pgPublicColumnExists("visitantes", "foto_url");
  if (hasFoto) {
    return prisma.$queryRaw<VisitanteTribunaPainel[]>(Prisma.sql`
      SELECT id, nome_completo, representacao, foto_url, motivo_visita
      FROM visitantes
      WHERE tenant_id = ${tenantId}::uuid
        AND COALESCE(disponivel_tribuna, false) = true
        AND data_saida IS NULL
        AND deleted_at IS NULL
      ORDER BY nome_completo ASC
    `);
  }
  return prisma.$queryRaw<VisitanteTribunaPainel[]>(Prisma.sql`
    SELECT id, nome_completo, representacao, NULL::varchar AS foto_url, motivo_visita
    FROM visitantes
    WHERE tenant_id = ${tenantId}::uuid
      AND COALESCE(disponivel_tribuna, false) = true
      AND data_saida IS NULL
      AND deleted_at IS NULL
    ORDER BY nome_completo ASC
  `);
}

type OratoriaTimerInternalState = {
  durationSec: number;
  remainingSec: number;
  isRunning: boolean;
  startedAtMs: number | null;
  speakerSolicitacaoId: string | null;
  pausedRemainingBySolicitacaoId: Record<string, number>;
  pausedSpeakerStack: string[];
  /** Presidente / expediente / operador: sem cronómetro no telão e no OBS. */
  speakerSemLimiteTempo: boolean;
};

const ORATORIA_DEFAULT_DURATION_SEC = 10 * 60;
const APARTE_DEFAULT_DURATION_SEC = 3 * 60;

type TenantSettingsLike = {
  oratoria_tempo?: {
    orador_minutos?: number | string | null;
    aparte_minutos?: number | string | null;
  } | null;
};

function getOratoriaDurationsFromTenantSettings(settings: Prisma.JsonValue | TenantSettingsLike | null | undefined) {
  const safeSettings = settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as TenantSettingsLike)
    : undefined;
  const oradorMin = Number(safeSettings?.oratoria_tempo?.orador_minutos);
  const aparteMin = Number(safeSettings?.oratoria_tempo?.aparte_minutos);
  return {
    oradorSec:
      Number.isFinite(oradorMin) && oradorMin > 0
        ? Math.round(oradorMin * 60)
        : ORATORIA_DEFAULT_DURATION_SEC,
    aparteSec:
      Number.isFinite(aparteMin) && aparteMin > 0
        ? Math.round(aparteMin * 60)
        : APARTE_DEFAULT_DURATION_SEC,
  };
}
const oratoriaTimers = new Map<string, OratoriaTimerInternalState>();

const MSG_MIG_STATUS_SOLICITACAO =
  "O PostgreSQL ainda bloqueia os estados EM_FALA e RECUSADA na tabela solicitacoes_palavra. Execute no servidor o ficheiro db/migrations/20260513000000_solicitacoes_palavra_status_em_fala_recusada.sql (psql ou o teu pipeline de migrações na VPS) e volte a tentar.";

function rethrowIfSolicitacaoStatusCheckFailed(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (
    lower.includes("check constraint") ||
    lower.includes("violates check") ||
    msg.includes("23514") ||
    (lower.includes("solicitacoes_palavra") && lower.includes("status"))
  ) {
    throw new Error(MSG_MIG_STATUS_SOLICITACAO);
  }
  throw e instanceof Error ? e : new Error(msg);
}

/** Cache/revalidate/emit não devem falhar a action depois do commit no Postgres. */
function safePainelSideEffects(run: () => void) {
  try {
    run();
  } catch (e) {
    console.warn("[painel] side-effects (revalidate/emit):", e);
  }
}

async function lockSessaoRowInTx(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">,
  sessaoId: string,
  tenantId: string
) {
  const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM sessoes
    WHERE id = ${sessaoId}::uuid AND tenant_id = ${tenantId}::uuid
    FOR UPDATE
  `);
  if (locked.length === 0) throw new Error("Sessão não encontrada.");
}

function getOrCreateOratoriaTimer(sessaoId: string) {
  const existing = oratoriaTimers.get(sessaoId);
  if (existing) return existing;
  const created: OratoriaTimerInternalState = {
    durationSec: ORATORIA_DEFAULT_DURATION_SEC,
    remainingSec: ORATORIA_DEFAULT_DURATION_SEC,
    isRunning: false,
    startedAtMs: null,
    speakerSolicitacaoId: null,
    pausedRemainingBySolicitacaoId: {},
    pausedSpeakerStack: [],
    speakerSemLimiteTempo: false,
  };
  oratoriaTimers.set(sessaoId, created);
  return created;
}

function snapshotOratoriaTimer(sessaoId: string, speakerSolicitacaoId?: string | null) {
  const timer = getOrCreateOratoriaTimer(sessaoId);
  const serverNowMs = Date.now();

  if (speakerSolicitacaoId !== undefined) {
    timer.speakerSolicitacaoId = speakerSolicitacaoId;
  }

  const pausedEntries = timer.pausedSpeakerStack
    .map((sid) => ({
      solicitacaoId: sid,
      remainingSec: timer.pausedRemainingBySolicitacaoId[sid] ?? ORATORIA_DEFAULT_DURATION_SEC,
    }))
    .filter((entry) => entry.solicitacaoId);

  if (timer.speakerSemLimiteTempo && timer.speakerSolicitacaoId) {
    return {
      durationSec: 0,
      remainingSec: 0,
      isRunning: false,
      startedAtMs: null,
      speakerSolicitacaoId: timer.speakerSolicitacaoId,
      semLimiteTempo: true,
      pausedEntries,
      pausedSpeakerStackSize: timer.pausedSpeakerStack.length,
      serverNowMs,
    };
  }

  if (timer.isRunning && timer.startedAtMs) {
    const elapsed = Math.max(0, Math.floor((serverNowMs - timer.startedAtMs) / 1000));
    const remaining = Math.max(0, timer.remainingSec - elapsed);
    if (remaining !== timer.remainingSec) {
      timer.remainingSec = remaining;
      timer.startedAtMs = serverNowMs;
    }
    if (remaining === 0) {
      timer.isRunning = false;
      timer.startedAtMs = null;
    }
  }

  return {
    durationSec: timer.durationSec,
    remainingSec: timer.remainingSec,
    isRunning: timer.isRunning,
    startedAtMs: timer.startedAtMs,
    speakerSolicitacaoId: timer.speakerSolicitacaoId,
    semLimiteTempo: false,
    pausedEntries,
    pausedSpeakerStackSize: timer.pausedSpeakerStack.length,
    serverNowMs,
  };
}

export async function getProximaSessao() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) {
    return {
      sessao: null,
      vereadores: [],
      ordemDoDia: [],
      solicitacoes: [],
      visitantesTribuna: [],
      votacaoAtiva: null,
      votos: [],
      oratoriaTimer: null,
      sessionVereadorId: null as string | null,
    };
  }

  const sessionVereadorId = await resolveVereadorIdDoUsuarioLogado(user.profile);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Prioriza sessão ativa, mesmo que tenha sido reaberta fora da data de hoje.
  const sessaoAtiva = await prisma.sessao.findFirst({
    where: {
      tenant_id: user.profile.tenant_id,
      status: {
        in: ["ABERTA", "EM_VOTACAO"],
      },
    },
    include: {
      presencas: {
        select: {
          id: true,
          vereador_id: true,
          status: true
        }
      }
    },
    orderBy: {
      updated_at: 'desc'
    }
  });

  // Se não houver ativa, busca a próxima sessão agendada a partir de hoje.
  const sessaoAgendada = sessaoAtiva
    ? null
    : await prisma.sessao.findFirst({
    where: {
      tenant_id: user.profile.tenant_id,
      data_sessao: {
        gte: hoje
      }
    },
    include: {
      presencas: {
        select: {
          id: true,
          vereador_id: true,
          status: true
        }
      }
    },
    orderBy: {
      data_sessao: 'asc'
    }
  });
  const sessao = sessaoAtiva ?? sessaoAgendada;

  // Busca todos os vereadores para compor o painel
  const vereadores = await prisma.vereador.findMany({
    where: {
      tenant_id: user.profile.tenant_id
    },
    orderBy: {
      nome_parlamentar: 'asc'
    }
  });

  if (sessao) {
    const fullData = await getPainelData(sessao.id, { includeTextoCompleto: true });
    return {
      ...fullData,
      vereadores: vereadores || []
    };
  }

  return { 
    sessao: null, 
    vereadores: vereadores || [],
    ordemDoDia: [],
    solicitacoes: [],
    visitantesTribuna: [],
    votacaoAtiva: null,
    votos: [],
    oratoriaTimer: null,
    sessionVereadorId,
  };
}


export async function registrarPresenca(sessaoId: string, tipo: PresencaTipo, vereadorIdOverride?: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const finalVereadorId =
    vereadorIdOverride || (user?.profile ? await resolveVereadorIdDoUsuarioLogado(user.profile) : null);
  if (!finalVereadorId) throw new Error("ID do vereador não identificado.");

  assertRateLimit(`presenca:${user.profile.id}:${sessaoId}`, {
    max: 8,
    windowMs: 30_000,
    message: "Muitas atualizações de presença em sequência. Aguarde alguns segundos.",
  });

  await prisma.presenca.upsert({
    where: {
      sessao_id_vereador_id: {
        sessao_id: sessaoId,
        vereador_id: finalVereadorId
      }
    },
    update: {
      status: tipo
    },
    create: {
      tenant_id: user.profile.tenant_id,
      sessao_id: sessaoId,
      vereador_id: finalVereadorId,
      status: tipo
    }
  });

  revalidatePath("/painel");
  emitSessionEvent(sessaoId, "PRESENCA_ATUALIZADA", { vereadorId: finalVereadorId, tipo });
  return { success: true };
}

/**
 * Encerra a sessão no plenário: status ENCERRADA, fila de palavra fechada, presenças PRESENTE → AUSENTE
 * (mantém FALTA_JUSTIFICADA), cronómetro de oratória limpo. Chamada pela UI do painel e por /sessoes.
 */
export async function encerrarSessaoPlenarioCompleto(tenantId: string, sessaoId: string) {
  const existe = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: tenantId },
    select: { id: true },
  });
  if (!existe) throw new Error("Sessão não encontrada.");

  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");

  await prisma.$transaction(async (tx) => {
    await tx.sessao.update({
      where: { id: sessaoId, tenant_id: tenantId },
      data: { status: "ENCERRADA", updated_at: new Date() },
    });

    await updateManySolicitacaoPendenteOuEmFalaAtendidoTx(tx, hasVisitanteCol, tenantId, sessaoId);

    await tx.presenca.updateMany({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        status: "PRESENTE",
      },
      data: { status: "AUSENTE" },
    });
  });

  const timer = getOrCreateOratoriaTimer(sessaoId);
  timer.speakerSolicitacaoId = null;
  timer.isRunning = false;
  timer.startedAtMs = null;
  timer.durationSec = ORATORIA_DEFAULT_DURATION_SEC;
  timer.remainingSec = ORATORIA_DEFAULT_DURATION_SEC;
  timer.pausedRemainingBySolicitacaoId = {};
  timer.pausedSpeakerStack = [];
  timer.speakerSemLimiteTempo = false;

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/vereador");
  revalidatePath("/painel/tv");
  revalidatePath("/sessoes");

  emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
    motivo: "SESSAO_ENCERRADA",
    timer: snapshotOratoriaTimer(sessaoId),
  });
}

export async function updateStatusSessao(sessaoId: string, status: SessaoStatus) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const tenantId = user.profile.tenant_id;

  if (String(status).toUpperCase() === "ENCERRADA") {
    await encerrarSessaoPlenarioCompleto(tenantId, sessaoId);
    return { success: true };
  }

  await prisma.sessao.update({
    where: { id: sessaoId, tenant_id: tenantId },
    data: { status, updated_at: new Date() },
  });

  revalidatePath("/painel");
  revalidatePath("/sessoes");
  return { success: true };
}

export async function getOrdemDoDia(sessaoId: string) {
  return await prisma.ordemDoDia.findMany({
    where: { sessao_id: sessaoId },
    include: {
      proposicao: {
        select: {
          id: true,
          numero: true,
          ano: true,
          ementa: true,
          tipo: true,
          autor: {
            select: { nome_parlamentar: true }
          }
        }
      }
    },
    orderBy: {
      ordem_sequencial: 'asc'
    }
  });
}

export async function adicionarNaPauta(sessaoId: string, proposicaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const ultima = await prisma.ordemDoDia.findFirst({
    where: { sessao_id: sessaoId },
    orderBy: { ordem_sequencial: 'desc' }
  });

  const novaOrdem = (ultima?.ordem_sequencial || 0) + 1;

  await prisma.ordemDoDia.create({
    data: {
      tenant_id: user.profile.tenant_id,
      sessao_id: sessaoId,
      proposicao_id: proposicaoId,
      ordem_sequencial: novaOrdem,
      status_discussao: 'AGUARDANDO'
    }
  });

  revalidatePath("/painel");
  emitSessionEvent(sessaoId, "PAUTA_ATUALIZADA", { proposicaoId });
  return { success: true };
}

export async function iniciarVotacao(sessaoId: string, proposicaoId: string, mesaToken?: string | null) {
  let tenantId: string;
  const raw = mesaToken != null ? String(mesaToken).trim() : "";
  if (raw) {
    const v = verifyPresidenteMesaToken(raw);
    if (!v || v.sessaoId !== sessaoId) throw new Error("Não autorizado.");
    const ok = await prisma.sessao.findFirst({
      where: { id: sessaoId, tenant_id: v.tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!ok) throw new Error("Sessão não encontrada.");
    tenantId = v.tenantId;
  } else {
    const user = await getCurrentUser();
    if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
    tenantId = user.profile.tenant_id;
  }

  const votacaoAberta = await prisma.votacao.findFirst({
    where: {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      status: "ABERTA",
      deleted_at: null,
    },
    select: { id: true },
  });
  if (votacaoAberta) {
    throw new Error("Já existe uma votação em aberto nesta sessão. Encerre antes de iniciar outra.");
  }

  const votacao = await prisma.votacao.create({
    data: {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      proposicao_id: proposicaoId,
      status: "ABERTA",
    },
  });

  await prisma.sessao.update({
    where: { id: sessaoId },
    data: { status: "EM_VOTACAO" },
  });

  revalidatePath("/painel");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/presidente/mesa");
  revalidatePath("/painel/operador");
  emitSessionEvent(sessaoId, "VOTACAO_INICIADA", { proposicaoId, votacaoId: votacao.id });
  return votacao;
}

export async function registrarVoto(votacaoId: string, voto: VotoTipo, vereadorIdOverride?: string) {
  const user = await getCurrentUser();
  const isAdminMaster = user?.profile?.role === "ADMIN_MASTER";
  const finalVereadorId =
    vereadorIdOverride ||
    (user?.profile ? await resolveVereadorIdDoUsuarioLogado(user.profile) : null);

  if (!finalVereadorId) throw new Error("Apenas vereadores votam.");
  if (vereadorIdOverride && !isAdminMaster) {
    throw new Error("Não autorizado para votar por outro vereador.");
  }
  if (!user?.profile?.id) throw new Error("Não autorizado.");

  assertRateLimit(`voto:${user.profile.id}:${votacaoId}`, {
    max: 6,
    windowMs: 10_000,
    message: "Muitas tentativas de voto em sequência. Aguarde alguns segundos.",
  });

  await prisma.voto.upsert({
    where: {
      votacao_id_vereador_id: {
        votacao_id: votacaoId,
        vereador_id: finalVereadorId
      }
    },
    update: { voto },
    create: {
      tenant_id: user.profile.tenant_id,
      votacao_id: votacaoId,
      vereador_id: finalVereadorId,
      voto
    }
  });

  const votacao = await prisma.votacao.findUnique({
    where: { id: votacaoId },
    select: { sessao_id: true }
  });
  if (votacao?.sessao_id) {
    emitSessionEvent(votacao.sessao_id, "VOTO_REGISTRADO", {
      votacaoId,
      vereadorId: finalVereadorId,
      voto
    });
  }

  return { success: true };
}

export async function encerrarVotacao(votacaoId: string, sessaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const votos = await prisma.voto.findMany({
    where: { votacao_id: votacaoId },
    select: { voto: true }
  });

  const sim = votos.filter(v => v.voto === 'SIM').length;
  const nao = votos.filter(v => v.voto === 'NAO').length;
  const resultado: ProposicaoStatus = sim > nao ? "APROVADO" : "REJEITADO";
  const tenantId = user.profile.tenant_id;
  const statusPauta = resultado === "APROVADO" ? "VOTADA_APROVADA" : "VOTADA_REJEITADA";

  const votacao = await prisma.votacao.findFirst({
    where: {
      id: votacaoId,
      sessao_id: sessaoId,
      tenant_id: tenantId,
    },
    select: {
      id: true,
      proposicao_id: true,
    },
  });
  if (!votacao) throw new Error("Votação não encontrada para esta sessão.");

  await prisma.$transaction(async (tx) => {
    await tx.votacao.update({
      where: { id: votacaoId },
      data: {
        status: 'ENCERRADA',
        resultado_calculado: resultado
      }
    });

    await tx.sessao.update({
      where: { id: sessaoId },
      data: { status: 'ABERTA' }
    });

    await tx.proposicao.update({
      where: { id: votacao.proposicao_id },
      data: { status: resultado },
    });

    await tx.ordemDoDia.updateMany({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        proposicao_id: votacao.proposicao_id,
      },
      data: {
        status_discussao: statusPauta,
      },
    });

    const destinoSetorId =
      user.profile.setor_id ||
      (await tx.setor.findFirst({
        where: { tenant_id: tenantId, deleted_at: null },
        select: { id: true },
      }))?.id ||
      null;

    if (destinoSetorId) {
      await tx.tramitacao.create({
        data: {
          tenant_id: tenantId,
          proposicao_id: votacao.proposicao_id,
          origem_setor_id: user.profile.setor_id || destinoSetorId,
          destino_setor_id: destinoSetorId,
          acao: "ENCAMINHADO",
          despacho_texto: `Votação encerrada em plenário. Resultado: ${resultado}. Placar — SIM: ${sim}, NÃO: ${nao}, ABSTENÇÃO: ${votos.filter(v => v.voto === 'ABSTENCAO').length}.`,
          usuario_id: user.profile.id,
          data_tramite: new Date(),
        },
      });
    }
  });

  revalidatePath("/painel");
  revalidatePath("/proposicoes");
  revalidatePath("/tramitacao");
  revalidatePath("/sessoes");
  emitSessionEvent(sessaoId, "VOTACAO_ENCERRADA", { votacaoId, resultado });
  return { resultado };
}

async function resolvePainelTenantAndActorForSessao(
  sessaoId: string,
  mesaToken?: string | null,
): Promise<{ tenantId: string; usuarioId: string; setorId: string | null }> {
  const raw = mesaToken != null ? String(mesaToken).trim() : "";
  if (raw) {
    const v = verifyPresidenteMesaToken(raw);
    if (!v || v.sessaoId !== sessaoId) throw new Error("Não autorizado.");
    const ok = await prisma.sessao.findFirst({
      where: { id: sessaoId, tenant_id: v.tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!ok) throw new Error("Sessão não encontrada.");
    const actor = await prisma.user.findFirst({
      where: { tenant_id: v.tenantId, deleted_at: null },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });
    if (!actor?.id) {
      throw new Error("Impossível registar tramitação automaticamente. Use o painel com login.");
    }
    return { tenantId: v.tenantId, usuarioId: actor.id, setorId: null };
  }
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  return {
    tenantId: user.profile.tenant_id,
    usuarioId: user.profile.id,
    setorId: user.profile.setor_id ?? null,
  };
}

export async function aplicarVotoMinerva(
  votacaoId: string,
  sessaoId: string,
  votoMinerva: "SIM" | "NAO" = "SIM",
  mesaToken?: string | null,
) {
  const { tenantId, usuarioId, setorId } = await resolvePainelTenantAndActorForSessao(sessaoId, mesaToken);
  const votacao = await prisma.votacao.findFirst({
    where: {
      id: votacaoId,
      sessao_id: sessaoId,
      tenant_id: tenantId,
      status: "ABERTA",
      deleted_at: null,
    },
    select: {
      id: true,
      proposicao_id: true,
    },
  });
  if (!votacao) throw new Error("Votação não encontrada ou já encerrada.");

  const votos = await prisma.voto.findMany({
    where: { votacao_id: votacaoId, tenant_id: tenantId },
    select: { voto: true },
  });

  const sim = votos.filter(v => v.voto === "SIM").length;
  const nao = votos.filter(v => v.voto === "NAO").length;
  const abs = votos.filter(v => v.voto === "ABSTENCAO").length;

  if (sim !== nao) {
    throw new Error("Voto minerva só pode ser aplicado em caso de empate.");
  }

  const resultado: ProposicaoStatus = votoMinerva === "SIM" ? "APROVADO" : "REJEITADO";
  const statusPauta = resultado === "APROVADO" ? "VOTADA_APROVADA" : "VOTADA_REJEITADA";

  await prisma.$transaction(async (tx) => {
    await tx.votacao.update({
      where: { id: votacaoId },
      data: {
        status: "ENCERRADA",
        resultado_calculado: resultado,
      },
    });

    await tx.sessao.update({
      where: { id: sessaoId },
      data: { status: "ABERTA" },
    });

    await tx.proposicao.update({
      where: { id: votacao.proposicao_id },
      data: { status: resultado },
    });

    await tx.ordemDoDia.updateMany({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        proposicao_id: votacao.proposicao_id,
      },
      data: {
        status_discussao: statusPauta,
      },
    });

    const destinoSetorId =
      setorId ||
      (await tx.setor.findFirst({
        where: { tenant_id: tenantId, deleted_at: null },
        select: { id: true },
      }))?.id ||
      null;

    if (destinoSetorId) {
      await tx.tramitacao.create({
        data: {
          tenant_id: tenantId,
          proposicao_id: votacao.proposicao_id,
          origem_setor_id: setorId || destinoSetorId,
          destino_setor_id: destinoSetorId,
          acao: "ENCAMINHADO",
          despacho_texto: `Votação encerrada por voto minerva da presidência. Resultado: ${resultado}. Placar base — SIM: ${sim}, NÃO: ${nao}, ABSTENÇÃO: ${abs}. Minerva: ${votoMinerva}.`,
          usuario_id: usuarioId,
          data_tramite: new Date(),
        },
      });
    }
  });

  revalidatePath("/painel");
  revalidatePath("/painel/presidente/mesa");
  revalidatePath("/proposicoes");
  revalidatePath("/tramitacao");
  revalidatePath("/sessoes");
  emitSessionEvent(sessaoId, "VOTACAO_ENCERRADA", { votacaoId, resultado, minerva: votoMinerva });
  return { resultado };
}

export async function avancarOrdemDoDia(sessaoId: string, mesaToken?: string | null) {
  let tenantId: string;
  const raw = mesaToken != null ? String(mesaToken).trim() : "";
  if (raw) {
    const v = verifyPresidenteMesaToken(raw);
    if (!v || v.sessaoId !== sessaoId) throw new Error("Não autorizado.");
    const ok = await prisma.sessao.findFirst({
      where: { id: sessaoId, tenant_id: v.tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!ok) throw new Error("Sessão não encontrada.");
    tenantId = v.tenantId;
  } else {
    const user = await getCurrentUser();
    if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
    tenantId = user.profile.tenant_id;
  }

  const votacaoAberta = await prisma.votacao.findFirst({
    where: {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      status: "ABERTA",
      deleted_at: null,
    },
    select: { id: true },
  });
  if (votacaoAberta) {
    throw new Error("Há uma votação em andamento. Encerre a votação antes de avançar a ordem do dia.");
  }

  const itemAtual = await prisma.ordemDoDia.findFirst({
    where: {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      status_discussao: "EM_DISCUSSAO",
      deleted_at: null,
    },
    orderBy: { ordem_sequencial: "asc" },
    select: { id: true, ordem_sequencial: true },
  });

  const proximoItem = await prisma.ordemDoDia.findFirst({
    where: {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      status_discussao: "AGUARDANDO",
      deleted_at: null,
      ...(itemAtual ? { ordem_sequencial: { gt: itemAtual.ordem_sequencial } } : {}),
    },
    orderBy: { ordem_sequencial: "asc" },
    select: { id: true, ordem_sequencial: true, proposicao_id: true },
  });

  if (!proximoItem) {
    throw new Error("Não há próximo item aguardando na ordem do dia.");
  }

  await prisma.$transaction(async (tx) => {
    if (itemAtual) {
      await tx.ordemDoDia.update({
        where: { id: itemAtual.id },
        data: { status_discussao: "DISCUTIDA" },
      });
    }

    await tx.ordemDoDia.update({
      where: { id: proximoItem.id },
      data: { status_discussao: "EM_DISCUSSAO" },
    });
  });

  revalidatePath("/painel");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/presidente/mesa");
  revalidatePath("/painel/operador");
  emitSessionEvent(sessaoId, "PAUTA_ATUALIZADA", {
    proposicaoId: proximoItem.proposicao_id,
    ordem: proximoItem.ordem_sequencial,
  });
  return {
    success: true,
    ordem: proximoItem.ordem_sequencial,
    proposicaoId: proximoItem.proposicao_id,
  };
}

/** Zera todos os votos da votação ainda ABERTA (mesma matéria); sessão permanece em EM_VOTACÃO. */
export async function reiniciarVotacaoAberta(votacaoId: string, sessaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  assertRateLimit(`reiniciar_votacao:${user.profile.id}:${votacaoId}`, {
    max: 4,
    windowMs: 60_000,
    message: "Muitas reinicializações em sequência. Aguarde um minuto.",
  });

  const votacao = await prisma.votacao.findFirst({
    where: {
      id: votacaoId,
      sessao_id: sessaoId,
      tenant_id: user.profile.tenant_id,
      status: "ABERTA",
      deleted_at: null,
    },
    select: { id: true },
  });
  if (!votacao) {
    throw new Error("Votação não encontrada, já encerrada ou não pertence a esta sessão.");
  }

  await prisma.voto.deleteMany({
    where: { votacao_id: votacaoId, tenant_id: user.profile.tenant_id },
  });

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  emitSessionEvent(sessaoId, "VOTACAO_REINICIADA", { votacaoId });
  return { success: true };
}

export async function solicitarPalavra(
  sessaoId: string,
  tipo: 'DISCURSO' | 'APARTE' | 'QUESTAO_ORDEM',
  vereadorIdOverride?: string
) {
  const user = await getCurrentUser();
  const isAdminMaster = user?.profile?.role === "ADMIN_MASTER";
  const finalVereadorId =
    vereadorIdOverride ||
    (user?.profile ? await resolveVereadorIdDoUsuarioLogado(user.profile) : null);
  if (!finalVereadorId) throw new Error("Apenas vereadores podem solicitar a palavra.");
  if (vereadorIdOverride && !isAdminMaster) {
    throw new Error("Não autorizado para solicitar palavra por outro vereador.");
  }
  if (!user?.profile?.id || !user.profile.tenant_id) throw new Error("Não autorizado.");

  assertRateLimit(`palavra:${user.profile.id}:${sessaoId}`, {
    max: 3,
    windowMs: 30_000,
    message: "Muitas solicitações de palavra em sequência. Aguarde alguns segundos.",
  });

  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");
  await insertSolicitacaoPalavraVereadorCore(prisma, hasVisitanteCol, {
    tenant_id: user.profile.tenant_id,
    sessao_id: sessaoId,
    vereador_id: finalVereadorId,
    tipo,
    status: "PENDENTE",
  });

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  emitSessionEvent(sessaoId, "PALAVRA_SOLICITADA", { tipo, vereadorId: finalVereadorId });
  return { success: true };
}

/** Permite ao operador inserir parlamentar na fila da pauta quando necessário. */
export async function solicitarPalavraOperador(
  sessaoId: string,
  vereadorId: string,
  tipo: 'DISCURSO' | 'APARTE' | 'QUESTAO_ORDEM' = 'DISCURSO'
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const tenantId = user.profile.tenant_id;

  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");

  await prisma.$transaction(async (tx) => {
    await lockSessaoRowInTx(tx, sessaoId, tenantId);
    const existente = await tx.solicitacaoPalavra.findFirst({
      where: {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        vereador_id: vereadorId,
        tipo,
        status: "PENDENTE",
      },
      select: { id: true },
    });
    if (existente) {
      throw new Error("Este vereador já está na fila da pauta.");
    }
    await insertSolicitacaoPalavraVereadorCore(tx, hasVisitanteCol, {
      tenant_id: tenantId,
      sessao_id: sessaoId,
      vereador_id: vereadorId,
      tipo,
      status: "PENDENTE",
    });
  });

  safePainelSideEffects(() => {
    revalidatePath("/painel");
    revalidatePath("/painel/operador");
    emitSessionEvent(sessaoId, "PALAVRA_SOLICITADA", { tipo, vereadorId, origem: "OPERADOR" });
  });
  return { success: true };
}

/** Orador externo (cadastro em Oradores) com "disponível na tribuna" — fila da pauta. */
export async function solicitarPalavraOperadorVisitante(
  sessaoId: string,
  visitanteId: string,
  tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM" = "DISCURSO"
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const hasSpVisitante = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");
  if (!hasSpVisitante) {
    throw new Error(
      "Oradores na tribuna ainda não está ativo neste banco. Aplique a migração SQL (coluna visitante_id em solicitacoes_palavra), por exemplo o ficheiro db/migrations/20260512160000_oradores_tribuna_foto.sql."
    );
  }

  const hasDisp = await pgPublicColumnExists("visitantes", "disponivel_tribuna");
  if (!hasDisp) {
    throw new Error(
      "Cadastro de oradores na tribuna incompleto: falta a coluna disponivel_tribuna em visitantes. Aplique a migração em db/migrations/20260512160000_oradores_tribuna_foto.sql."
    );
  }

  type Snap = { id: string; nome_completo: string; foto_url: string | null; representacao: string | null };
  const hasFoto = await pgPublicColumnExists("visitantes", "foto_url");
  const visitanteRows = hasFoto
    ? await prisma.$queryRaw<Snap[]>(Prisma.sql`
        SELECT id, nome_completo, foto_url, representacao
        FROM visitantes
        WHERE id = ${visitanteId}::uuid
          AND tenant_id = ${user.profile.tenant_id}::uuid
          AND COALESCE(disponivel_tribuna, false) = true
          AND data_saida IS NULL
          AND deleted_at IS NULL
        LIMIT 1
      `)
    : await prisma.$queryRaw<Snap[]>(Prisma.sql`
        SELECT id, nome_completo, NULL::varchar AS foto_url, representacao
        FROM visitantes
        WHERE id = ${visitanteId}::uuid
          AND tenant_id = ${user.profile.tenant_id}::uuid
          AND COALESCE(disponivel_tribuna, false) = true
          AND data_saida IS NULL
          AND deleted_at IS NULL
        LIMIT 1
      `);
  const visitante = visitanteRows[0] ?? null;
  if (!visitante) {
    throw new Error("Orador não encontrado ou não está liberado para a tribuna (ative em Oradores).");
  }

  const tenantId = user.profile.tenant_id;

  await prisma.$transaction(async (tx) => {
    await lockSessaoRowInTx(tx, sessaoId, tenantId);
    const dup = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM solicitacoes_palavra
      WHERE tenant_id = ${tenantId}::uuid
        AND sessao_id = ${sessaoId}::uuid
        AND visitante_id = ${visitanteId}::uuid
        AND tipo = ${tipo}
        AND status = 'PENDENTE'
      LIMIT 1
    `);
    if (dup.length > 0) {
      throw new Error("Este orador já está na fila.");
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO solicitacoes_palavra (tenant_id, sessao_id, vereador_id, visitante_id, tipo, status)
      VALUES (
        ${tenantId}::uuid,
        ${sessaoId}::uuid,
        NULL,
        ${visitanteId}::uuid,
        ${tipo},
        'PENDENTE'
      )
    `);
  });

  safePainelSideEffects(() => {
    revalidatePath("/painel");
    revalidatePath("/painel/operador");
    emitSessionEvent(sessaoId, "PALAVRA_SOLICITADA", {
      tipo,
      visitanteId,
      origem: "OPERADOR",
      visitante: {
        id: visitante.id,
        nome_completo: visitante.nome_completo,
        foto_url: visitante.foto_url,
        representacao: visitante.representacao,
      },
    });
  });
  return { success: true };
}

export async function getSolicitacoesPalavra(sessaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];
  return solicitacoesPalavraListComRelacoes(sessaoId, user.profile.tenant_id);
}

/**
 * Coloca parlamentar ou orador externo em tribuna sem cronómetro (expediente, leitura pela mesa, etc.).
 * Aparece no overlay OBS como orador atual, sem contagem regressiva.
 */
export async function iniciarFalaSemLimiteOperador(
  sessaoId: string,
  opts: { vereadorId?: string; visitanteId?: string },
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const tenantId = user.profile.tenant_id;
  const vereadorId = opts.vereadorId?.trim() || undefined;
  const visitanteId = opts.visitanteId?.trim() || undefined;
  if (!vereadorId && !visitanteId) throw new Error("Selecione um vereador ou orador externo.");
  if (vereadorId && visitanteId) throw new Error("Informe apenas um orador por vez.");

  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");
  if (visitanteId && !hasVisitanteCol) {
    throw new Error(
      "Oradores na tribuna ainda não está ativo neste banco. Aplique a migração SQL (visitante_id em solicitacoes_palavra).",
    );
  }

  const timer = getOrCreateOratoriaTimer(sessaoId);

  const pendenteWhere = vereadorId
    ? { tenant_id: tenantId, sessao_id: sessaoId, vereador_id: vereadorId, status: "PENDENTE" as const }
    : { tenant_id: tenantId, sessao_id: sessaoId, visitante_id: visitanteId!, status: "PENDENTE" as const };

  if (hasVisitanteCol) {
    const pendente = await prisma.solicitacaoPalavra.findFirst({
      where: pendenteWhere,
      orderBy: { created_at: "desc" },
      select: { id: true },
    });
    if (pendente) {
      await atenderSolicitacao(pendente.id, { semLimiteTempo: true });
      return { success: true, solicitacaoId: pendente.id };
    }

    const emFala = await prisma.solicitacaoPalavra.findFirst({
      where: vereadorId
        ? { tenant_id: tenantId, sessao_id: sessaoId, vereador_id: vereadorId, status: "EM_FALA" }
        : { tenant_id: tenantId, sessao_id: sessaoId, visitante_id: visitanteId!, status: "EM_FALA" },
      select: { id: true },
    });
    if (emFala) {
      await prisma.$transaction(async (tx) => {
        await updateManySolicitacaoEmFalaAtendidoExcetoTx(tx, hasVisitanteCol, tenantId, sessaoId, emFala.id);
      });
      aplicarTimerOratoriaSemLimite(timer, emFala.id);
      revalidatePath("/painel");
      revalidatePath("/painel/operador");
      emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
        motivo: "FALA_SEM_LIMITE",
        solicitacaoId: emFala.id,
      });
      return { success: true, solicitacaoId: emFala.id };
    }
  } else if (vereadorId) {
    const pendenteRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM solicitacoes_palavra
      WHERE tenant_id = ${tenantId}::uuid AND sessao_id = ${sessaoId}::uuid
        AND vereador_id = ${vereadorId}::uuid AND status = 'PENDENTE'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (pendenteRows[0]) {
      await atenderSolicitacao(pendenteRows[0].id, { semLimiteTempo: true });
      return { success: true, solicitacaoId: pendenteRows[0].id };
    }
    const emFalaRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM solicitacoes_palavra
      WHERE tenant_id = ${tenantId}::uuid AND sessao_id = ${sessaoId}::uuid
        AND vereador_id = ${vereadorId}::uuid AND status = 'EM_FALA'
      LIMIT 1
    `);
    if (emFalaRows[0]) {
      aplicarTimerOratoriaSemLimite(timer, emFalaRows[0].id);
      revalidatePath("/painel");
      revalidatePath("/painel/operador");
      emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
        motivo: "FALA_SEM_LIMITE",
        solicitacaoId: emFalaRows[0].id,
      });
      return { success: true, solicitacaoId: emFalaRows[0].id };
    }
  }

  let novaSolicitacaoId: string;

  await prisma.$transaction(async (tx) => {
    await lockSessaoRowInTx(tx, sessaoId, tenantId);
    await updateManySolicitacaoEmFalaAtendidoTodosTx(tx, hasVisitanteCol, tenantId, sessaoId);

    if (vereadorId) {
      novaSolicitacaoId = await insertSolicitacaoPalavraVereadorCore(tx, hasVisitanteCol, {
        tenant_id: tenantId,
        sessao_id: sessaoId,
        vereador_id: vereadorId,
        tipo: "DISCURSO",
        status: "EM_FALA",
      });
    } else {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        INSERT INTO solicitacoes_palavra (tenant_id, sessao_id, vereador_id, visitante_id, tipo, status)
        VALUES (
          ${tenantId}::uuid,
          ${sessaoId}::uuid,
          NULL,
          ${visitanteId!}::uuid,
          'DISCURSO',
          'EM_FALA'
        )
        RETURNING id
      `);
      novaSolicitacaoId = rows[0]!.id;
    }
  });

  aplicarTimerOratoriaSemLimite(timer, novaSolicitacaoId!);

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/vereador");
  revalidatePath("/painel/tv");
  emitSessionEvent(
    sessaoId,
    "SESSAO_ATUALIZADA",
    { motivo: "FALA_SEM_LIMITE", solicitacaoId: novaSolicitacaoId!, vereadorId, visitanteId },
    { dedupeKey: `sem-limite:${vereadorId ?? visitanteId}`, dedupeMs: 400 },
  );

  return { success: true, solicitacaoId: novaSolicitacaoId! };
}

export async function atenderSolicitacao(
  id: string,
  options?: { semLimiteTempo?: boolean },
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  if (isOptimisticPainelSolicitacaoId(id)) {
    throw new Error("Aguarde a sincronização do painel (o pedido ainda não tem ID no servidor).");
  }

  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");
  const existente = await loadSolicitacaoPalavraParaAtender(user.profile.tenant_id, id, hasVisitanteCol);
  if (!existente) throw new Error("Solicitação não encontrada.");

  const isPresidenteMesa = isOradorPresidenteMesa(existente);

  const atualEmFala = hasVisitanteCol
    ? await prisma.solicitacaoPalavra.findFirst({
        where: {
          tenant_id: user.profile.tenant_id,
          sessao_id: existente.sessao_id,
          status: "EM_FALA",
        },
        select: { id: true, tipo: true },
      })
    : (
        await prisma.$queryRaw<{ id: string; tipo: string }[]>(Prisma.sql`
          SELECT id, tipo
          FROM solicitacoes_palavra
          WHERE tenant_id = ${user.profile.tenant_id}::uuid
            AND sessao_id = ${existente.sessao_id}::uuid
            AND status = 'EM_FALA'
          LIMIT 1
        `)
      )[0] ?? null;

  const timer = getOrCreateOratoriaTimer(existente.sessao_id);
  if (atualEmFala?.id) {
    timer.speakerSolicitacaoId = atualEmFala.id;
  }
  const timerBefore = snapshotOratoriaTimer(existente.sessao_id);
  const tipoNovo = String(existente.tipo || "").toUpperCase();
  const tipoAtual = String(atualEmFala?.tipo || "").toUpperCase();
  const isAparteOuQuestao = tipoNovo === "APARTE" || tipoNovo === "QUESTAO_ORDEM";
  const isAtualDiscurso = tipoAtual === "DISCURSO";
  const durations = getOratoriaDurationsFromTenantSettings(user.profile?.tenant?.settings);

  try {
    await prisma.$transaction(async (tx) => {
      if (atualEmFala?.id && atualEmFala.id !== existente.id) {
        if (isAparteOuQuestao && isAtualDiscurso) {
          await updateSolicitacaoPalavraStatusPorIdTx(tx, hasVisitanteCol, atualEmFala.id, "PENDENTE");
        } else {
          await updateSolicitacaoPalavraStatusPorIdTx(tx, hasVisitanteCol, atualEmFala.id, "ATENDIDO");
        }
      } else {
        await updateManySolicitacaoEmFalaAtendidoExcetoTx(
          tx,
          hasVisitanteCol,
          user.profile.tenant_id,
          existente.sessao_id,
          existente.id,
        );
      }

      await updateSolicitacaoPalavraStatusPorIdTx(tx, hasVisitanteCol, existente.id, "EM_FALA");
    });
  } catch (e) {
    rethrowIfSolicitacaoStatusCheckFailed(e);
  }

  if (atualEmFala?.id && atualEmFala.id !== existente.id && isAparteOuQuestao && isAtualDiscurso) {
    timer.pausedRemainingBySolicitacaoId[atualEmFala.id] = timerBefore.remainingSec;
    if (!timer.pausedSpeakerStack.includes(atualEmFala.id)) {
      timer.pausedSpeakerStack.push(atualEmFala.id);
    }
  }

  if (isPresidenteMesa || options?.semLimiteTempo) {
    aplicarTimerOratoriaSemLimite(timer, existente.id);
  } else {
    timer.speakerSemLimiteTempo = false;
    const pausedRemaining = timer.pausedRemainingBySolicitacaoId[existente.id];
    if (pausedRemaining != null) {
      timer.remainingSec = pausedRemaining;
      delete timer.pausedRemainingBySolicitacaoId[existente.id];
      timer.pausedSpeakerStack = timer.pausedSpeakerStack.filter((sid) => sid !== existente.id);
      timer.durationSec = isAparteOuQuestao ? durations.aparteSec : durations.oradorSec;
    } else {
      timer.durationSec = isAparteOuQuestao ? durations.aparteSec : durations.oradorSec;
      timer.remainingSec = timer.durationSec;
    }
    timer.isRunning = false;
    timer.startedAtMs = null;
    timer.speakerSolicitacaoId = existente.id;
  }

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/tv");
  emitSessionEvent(
    existente.sessao_id,
    "SESSAO_ATUALIZADA",
    { motivo: "SOLICITACAO_ATENDIDA", solicitacaoId: id },
    { dedupeKey: `atender:${id}`, dedupeMs: 400 }
  );
}

export async function concluirFalaAtual(sessaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const tenantId = user.profile.tenant_id;
  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");

  const atuaisEmFala = hasVisitanteCol
    ? await prisma.solicitacaoPalavra.findMany({
        where: {
          tenant_id: tenantId,
          sessao_id: sessaoId,
          status: "EM_FALA",
        },
        select: { id: true, tipo: true },
      })
    : await prisma.$queryRaw<{ id: string; tipo: string }[]>(Prisma.sql`
        SELECT id, tipo
        FROM solicitacoes_palavra
        WHERE tenant_id = ${tenantId}::uuid AND sessao_id = ${sessaoId}::uuid AND status = 'EM_FALA'
      `);
  if (!atuaisEmFala.length) throw new Error("Não há orador em fala para concluir.");

  const timer = getOrCreateOratoriaTimer(sessaoId);
  const oradorAtual = atuaisEmFala[0] ?? null;
  const durations = getOratoriaDurationsFromTenantSettings(user.profile?.tenant?.settings);
  const resolution = resolveConclusaoFalaAtual({
    currentSpeakerId: oradorAtual?.id ?? null,
    currentSpeakerTipo: oradorAtual?.tipo ?? null,
    defaultOradorSec: durations.oradorSec,
    timer: {
      durationSec: timer.durationSec,
      remainingSec: timer.remainingSec,
      isRunning: timer.isRunning,
      startedAtMs: timer.startedAtMs,
      speakerSolicitacaoId: timer.speakerSolicitacaoId,
      pausedRemainingBySolicitacaoId: { ...timer.pausedRemainingBySolicitacaoId },
      pausedSpeakerStack: [...timer.pausedSpeakerStack],
      speakerSemLimiteTempo: timer.speakerSemLimiteTempo,
    },
  });

  await prisma.$transaction(async (tx) => {
    if (resolution.mode === "RESUME_PAUSED" && resolution.resumedSpeakerId) {
      await updateManySolicitacaoEmFalaAtendidoExcetoTx(
        tx,
        hasVisitanteCol,
        tenantId,
        sessaoId,
        resolution.resumedSpeakerId,
      );
      await updateSolicitacaoPalavraStatusPorIdTx(tx, hasVisitanteCol, resolution.resumedSpeakerId, "EM_FALA");
    } else {
      await updateManySolicitacaoEmFalaAtendidoTodosTx(tx, hasVisitanteCol, tenantId, sessaoId);
    }
  });

  timer.speakerSolicitacaoId = resolution.timer.speakerSolicitacaoId;
  timer.isRunning = resolution.timer.isRunning;
  timer.startedAtMs = resolution.timer.startedAtMs;
  timer.durationSec = resolution.timer.durationSec;
  timer.remainingSec = resolution.timer.remainingSec;
  timer.pausedRemainingBySolicitacaoId = resolution.timer.pausedRemainingBySolicitacaoId;
  timer.pausedSpeakerStack = resolution.timer.pausedSpeakerStack;
  timer.speakerSemLimiteTempo = resolution.timer.speakerSemLimiteTempo;

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/vereador");
  revalidatePath("/painel/tv");
  emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
    motivo: "FALA_CONCLUIDA",
    timer: snapshotOratoriaTimer(sessaoId),
    resumedSpeakerId: resolution.resumedSpeakerId,
  });

  return {
    success: true,
    resumed: resolution.mode === "RESUME_PAUSED",
    resumedSpeakerId: resolution.resumedSpeakerId,
  };
}

export async function controlarTimerOratoria(
  sessaoId: string,
  action: "START" | "STOP" | "RESET"
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const timer = getOrCreateOratoriaTimer(sessaoId);
  const snapshot = snapshotOratoriaTimer(sessaoId);

  if (timer.speakerSemLimiteTempo) {
    const result = snapshotOratoriaTimer(sessaoId);
    revalidatePath("/painel");
    revalidatePath("/painel/operador");
    revalidatePath("/painel/presidente");
    revalidatePath("/painel/vereador");
    revalidatePath("/painel/tv");
    emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
      motivo: "TIMER_ORATORIA",
      action,
      timer: result,
    });
    return result;
  }

  if (action === "START") {
    if (snapshot.remainingSec <= 0) {
      throw new Error("Tempo esgotado. Reinicie o cronômetro antes de iniciar.");
    }
    timer.isRunning = true;
    timer.startedAtMs = Date.now();
  } else if (action === "STOP") {
    const current = snapshotOratoriaTimer(sessaoId);
    timer.remainingSec = current.remainingSec;
    timer.isRunning = false;
    timer.startedAtMs = null;
  } else if (action === "RESET") {
    timer.durationSec = ORATORIA_DEFAULT_DURATION_SEC;
    timer.remainingSec = ORATORIA_DEFAULT_DURATION_SEC;
    timer.isRunning = false;
    timer.startedAtMs = null;
    timer.speakerSemLimiteTempo = false;
  }

  const result = snapshotOratoriaTimer(sessaoId);
  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/vereador");
  revalidatePath("/painel/tv");
  emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
    motivo: "TIMER_ORATORIA",
    action,
    timer: result,
  });
  return result;
}

export async function ajustarTimerOratoria(sessaoId: string, deltaSeconds: number) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const timer = getOrCreateOratoriaTimer(sessaoId);
  if (timer.speakerSemLimiteTempo) {
    throw new Error("Presidente da mesa não tem limite de tempo de oratória.");
  }
  const snapshot = snapshotOratoriaTimer(sessaoId);
  const nextRemaining = Math.max(0, snapshot.remainingSec + Math.floor(deltaSeconds));
  timer.remainingSec = nextRemaining;
  timer.startedAtMs = timer.isRunning ? Date.now() : null;

  const result = snapshotOratoriaTimer(sessaoId);
  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  revalidatePath("/painel/presidente");
  revalidatePath("/painel/vereador");
  revalidatePath("/painel/tv");
  emitSessionEvent(sessaoId, "SESSAO_ATUALIZADA", {
    motivo: "TIMER_ORATORIA_AJUSTE",
    deltaSeconds,
    timer: result,
  });
  return result;
}

export async function recusarSolicitacao(id: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  if (isOptimisticPainelSolicitacaoId(id)) {
    throw new Error("Aguarde a sincronização do painel (o pedido ainda não tem ID no servidor).");
  }

  const hasVisitanteCol = await pgPublicColumnExists("solicitacoes_palavra", "visitante_id");

  const existente = hasVisitanteCol
    ? await prisma.solicitacaoPalavra.findFirst({
        where: { id, tenant_id: user.profile.tenant_id },
        select: { sessao_id: true, status: true },
      })
    : (
        await prisma.$queryRaw<{ sessao_id: string; status: string }[]>(Prisma.sql`
          SELECT sessao_id, status
          FROM solicitacoes_palavra
          WHERE id = ${id}::uuid AND tenant_id = ${user.profile.tenant_id}::uuid
          LIMIT 1
        `)
      )[0] ?? null;
  if (!existente) throw new Error("Solicitação não encontrada.");

  try {
    await updateSolicitacaoPalavraStatusPorIdTx(prisma, hasVisitanteCol, id, "RECUSADA");
  } catch (e) {
    rethrowIfSolicitacaoStatusCheckFailed(e);
  }

  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  emitSessionEvent(
    existente.sessao_id,
    "SESSAO_ATUALIZADA",
    { motivo: "SOLICITACAO_RECUSADA", solicitacaoId: id },
    { dedupeKey: `recusar:${id}`, dedupeMs: 400 }
  );
}

async function fetchPainelDataBundle(
  tenantId: string,
  sessaoId: string,
  tenantSettings: Prisma.JsonValue | null | undefined,
  options?: { includeTextoCompleto?: boolean },
) {
  const [sessao, ordemDoDia, solicitacoes, visitantesTribuna] = await Promise.all([
    prisma.sessao.findFirst({
      where: { id: sessaoId, tenant_id: tenantId },
      include: {
        presencas: true,
      },
    }),
    prisma.ordemDoDia.findMany({
      where: { sessao_id: sessaoId, tenant_id: tenantId },
      include: {
        proposicao: {
          include: {
            autor: true,
          },
        },
      },
      orderBy: { ordem_sequencial: "asc" },
    }),
    solicitacoesPalavraListComRelacoes(sessaoId, tenantId),
    visitantesTribunaParaPainel(tenantId),
  ]);

  const includeTextoCompleto = options?.includeTextoCompleto === true;
  const oradorAtual = pickOradorEmFala(solicitacoes);
  const timerMem = getOrCreateOratoriaTimer(sessaoId);
  if (oradorAtual && isOradorPresidenteMesa(oradorAtual)) {
    timerMem.speakerSolicitacaoId = oradorAtual.id;
    aplicarTimerOratoriaSemLimite(timerMem, oradorAtual.id);
  } else if (
    oradorAtual?.id &&
    timerMem.speakerSolicitacaoId === oradorAtual.id &&
    timerMem.speakerSemLimiteTempo
  ) {
    timerMem.isRunning = false;
    timerMem.startedAtMs = null;
  } else {
    timerMem.speakerSemLimiteTempo = false;
  }
  if (oradorAtual?.id) {
    timerMem.speakerSolicitacaoId = oradorAtual.id;
  } else if (!timerMem.isRunning) {
    timerMem.speakerSolicitacaoId = null;
  }

  const durations = getOratoriaDurationsFromTenantSettings(tenantSettings);
  const defaultDurationSec =
    oradorAtual && ["APARTE", "QUESTAO_ORDEM"].includes(String(oradorAtual.tipo ?? "").toUpperCase())
      ? durations.aparteSec
      : durations.oradorSec;
  const oratoriaTimer = snapshotOratoriaTimer(sessaoId);
  if (!oradorAtual?.id && !timerMem.isRunning) {
    timerMem.durationSec = defaultDurationSec;
    timerMem.remainingSec = defaultDurationSec;
  }

  const votacaoAtiva = await prisma.votacao.findFirst({
    where: {
      sessao_id: sessaoId,
      tenant_id: tenantId,
      status: "ABERTA",
    },
    include: {
      votos: true,
      proposicao: {
        select: {
          id: true,
          tipo: true,
          numero: true,
          ano: true,
          ementa: true,
          ...(includeTextoCompleto ? { texto_completo: true } : {}),
          pdf_url: true,
          autor: { select: { nome_parlamentar: true } },
        },
      },
    },
  });

  return {
    sessao,
    ordemDoDia,
    solicitacoes,
    visitantesTribuna,
    oratoriaTimer,
    votacaoAtiva,
    votos: votacaoAtiva?.votos || [],
  };
}

export async function getPainelData(
  sessaoId: string,
  options?: { includeTextoCompleto?: boolean },
) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) {
    throw new Error("Não autorizado");
  }
  const bundle = await fetchPainelDataBundle(
    user.profile.tenant_id,
    sessaoId,
    user.profile?.tenant?.settings,
    options,
  );
  const sessionVereadorId = await resolveVereadorIdDoUsuarioLogado(user.profile);
  return { ...bundle, sessionVereadorId };
}

/** Leitura do painel por tenant (overlays OBS públicos, sem cookie). */
export async function getPainelDataForTenantPublic(
  tenantId: string,
  sessaoId: string,
  options?: { includeTextoCompleto?: boolean },
) {
  const ok = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!ok) throw new Error("Sessão não encontrada.");
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { settings: true },
  });
  const bundle = await fetchPainelDataBundle(tenantId, sessaoId, tenant?.settings ?? null, options);
  return { ...bundle, sessionVereadorId: null as string | null };
}

/** Leitura do painel da mesa com token (sem cookie de sessão). */
export async function getPainelDataPresidenteMesa(sessaoId: string, mesaToken: string) {
  const v = verifyPresidenteMesaToken(String(mesaToken).trim());
  if (!v || v.sessaoId !== sessaoId) {
    throw new Error("Token inválido ou expirado.");
  }
  const ok = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: v.tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!ok) throw new Error("Sessão não encontrada.");
  const tenant = await prisma.tenant.findFirst({
    where: { id: v.tenantId },
    select: { settings: true },
  });
  const bundle = await fetchPainelDataBundle(v.tenantId, sessaoId, tenant?.settings ?? null, {
    includeTextoCompleto: true,
  });
  return { ...bundle, sessionVereadorId: null as string | null };
}

/** Gera token para o painel da mesa abrir sem login (operador/admin autenticado). */
export async function emitirPresidenteMesaToken(sessaoId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");
  const ok = await prisma.sessao.findFirst({
    where: { id: sessaoId, tenant_id: user.profile.tenant_id, deleted_at: null },
    select: { id: true },
  });
  if (!ok) throw new Error("Sessão não encontrada.");
  assertRateLimit(`mesa_token:${user.profile.id}:${sessaoId}`, {
    max: 12,
    windowMs: 60_000,
    message: "Aguarde um minuto antes de gerar novos links da mesa.",
  });
  return { token: signPresidenteMesaToken(sessaoId, user.profile.tenant_id) };
}
