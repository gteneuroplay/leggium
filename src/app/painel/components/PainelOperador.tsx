'use client';

import Image from "next/image";
import { Play, Square, RotateCcw, UserCheck, Vote, Mic2, HelpCircle, Power, ClipboardList, Loader2, Check, X, Plus, Tv, Infinity } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { iniciarVotacao, encerrarVotacao, reiniciarVotacaoAberta, updateStatusSessao, atenderSolicitacao, recusarSolicitacao, solicitarPalavraOperador, solicitarPalavraOperadorVisitante, controlarTimerOratoria, concluirFalaAtual, ajustarTimerOratoria, iniciarFalaSemLimiteOperador } from "../actions";
import {
  nomeOradorSolicitacao,
  iniciaisOradorSolicitacao,
  fotoOradorSolicitacao,
  pickOradorEmFala,
  isOradorPresidenteMesa,
} from "@/lib/painel/orador-display";
import { isOptimisticPainelSolicitacaoId } from "@/lib/painel/solicitacao-ids";
import { toast } from "react-hot-toast";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { reloadOnceIfStaleClientServerAction } from "@/lib/next-stale-server-action";
import { isProposicaoPautaManual } from "@/lib/pauta/pauta-manual";
import { useOratoriaLastMinuteAlert } from "@/hooks/use-oratoria-last-minute-alert";
import { computeTempoRestanteOratoriaSec, type OratoriaTimerLike } from "@/lib/painel/oratoria-tempo-restante";

type PresencaLike = {
  vereador_id?: string | null;
  status?: string | null;
};

type SessaoLike = {
  id: string;
  status?: string | null;
  presencas?: PresencaLike[] | null;
};

type VereadorLike = {
  id: string;
  nome: string;
  nome_parlamentar?: string | null;
  partido?: string | null;
  foto_url?: string | null;
};

type VisitanteTribunaLike = {
  id: string;
  nome_completo: string;
  foto_url?: string | null;
  representacao?: string | null;
};

type ProposicaoLike = {
  id: string;
  tipo?: string | null;
  numero?: string | number | null;
  ano?: string | number | null;
  ementa?: string | null;
  texto_completo?: string | null;
  status?: string | null;
};

type OrdemDoDiaItemLike = {
  id: string;
  status_discussao?: string | null;
  proposicao: ProposicaoLike;
};

type VotacaoAtivaLike = {
  id: string;
  proposicao_id?: string | null;
};

type VotoLike = {
  vereador_id?: string | null;
  voto?: "SIM" | "NAO" | "ABSTENCAO" | null;
};

type SolicitacaoLike = {
  id: string;
  status?: string | null;
  tipo?: string | null;
  vereador_id?: string | null;
  visitante_id?: string | null;
  updated_at?: string | null;
  vereador?: { nome_parlamentar?: string | null; cargo_mesa?: string | null; foto_url?: string | null } | null;
  visitante?: { nome_completo?: string | null; representacao?: string | null; foto_url?: string | null } | null;
};

type OratoriaTimerSnapshot = OratoriaTimerLike & {
  speakerSolicitacaoId?: string | null;
  pausedEntries?: Array<{ solicitacaoId: string; remainingSec: number }>;
};

type PainelOperadorProps = {
  sessao: SessaoLike;
  vereadores: VereadorLike[];
  visitantesTribuna?: VisitanteTribunaLike[];
  onMarcarPresenca: (vid: string) => void;
  presencaPendingId?: string | null;
  ordemDoDia: OrdemDoDiaItemLike[];
  votacaoAtiva: VotacaoAtivaLike | null;
  votos: VotoLike[];
  solicitacoes?: SolicitacaoLike[];
  oratoriaTimer?: OratoriaTimerSnapshot | null;
  oratoriaClockSkewMs?: number;
  mergeOptimisticSolicitacao?: (vereadorId: string, tipo?: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM") => void;
  mergeOptimisticSolicitacaoVisitante?: (vt: VisitanteTribunaLike) => void;
  reconcilePainel?: () => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function labelTipoSolicitacao(tipo: unknown) {
  const t = String(tipo ?? "").toUpperCase();
  if (t === "DISCURSO") return "Palavra (pauta)";
  if (t === "APARTE") return "Aparte";
  if (t === "QUESTAO_ORDEM") return "Questão de ordem";
  return t || "—";
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function PainelOperador({ 
  sessao, 
  vereadores,
  visitantesTribuna = [],
  onMarcarPresenca,
  presencaPendingId = null,
  ordemDoDia,
  votacaoAtiva,
  votos,
  solicitacoes = [],
  oratoriaTimer,
  oratoriaClockSkewMs = 0,
  mergeOptimisticSolicitacao,
  mergeOptimisticSolicitacaoVisitante,
  reconcilePainel,
}: PainelOperadorProps) {
  const [agora, setAgora] = useState<number>(0);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const isPending = (key: string) => pending.has(key);
  const withBusy = useCallback(async (key: string, fn: () => Promise<void>) => {
    setPending((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);
  const [recusarModalId, setRecusarModalId] = useState<string | null>(null);
  const [encerrarModalOpen, setEncerrarModalOpen] = useState(false);
  const [reiniciarVotacaoModalOpen, setReiniciarVotacaoModalOpen] = useState(false);
  const [reabrirVotacaoItem, setReabrirVotacaoItem] = useState<OrdemDoDiaItemLike | null>(null);
  const [solicitacoesOcultas, setSolicitacoesOcultas] = useState<Set<string>>(() => new Set());
  const [tvAppModalOpen, setTvAppModalOpen] = useState(false);
  const oradorAtual = pickOradorEmFala(solicitacoes) as SolicitacaoLike | undefined;

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const solicitacoesOcultasPendentes = useMemo(() => {
    const pendentes = new Set(
      solicitacoes
        .filter((s) => String(s.status ?? "").trim().toUpperCase() === "PENDENTE")
        .map((s) => s.id)
    );
    const next = new Set<string>();
    for (const id of solicitacoesOcultas) {
      if (pendentes.has(id)) next.add(id);
    }
    return next;
  }, [solicitacoes, solicitacoesOcultas]);

  const handleAtenderSemLimite = async (id: string) => {
    if (isOptimisticPainelSolicitacaoId(id)) {
      toast.error("Aguarde a sincronização do pedido antes de colocar em fala.");
      await reconcilePainel?.();
      return;
    }
    const k = `atender-sem-limite:${id}`;
    await withBusy(k, async () => {
      try {
        await atenderSolicitacao(id, { semLimiteTempo: true });
        await reconcilePainel?.();
        toast.success("Em fala no telão/OBS — sem limite de tempo.");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Ocorreu um erro."));
        await reconcilePainel?.();
      }
    });
  };

  const handleIniciarFalaSemLimiteVereador = async (vereadorId: string) => {
    await withBusy(`sem-limite-v:${vereadorId}`, async () => {
      try {
        await iniciarFalaSemLimiteOperador(sessao.id, { vereadorId });
        await reconcilePainel?.();
        toast.success("Parlamentar em tribuna (sem tempo) — visível no OBS.");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível iniciar a fala."));
        await reconcilePainel?.();
      }
    });
  };

  const handleIniciarFalaSemLimiteVisitante = async (visitanteId: string) => {
    await withBusy(`sem-limite-vt:${visitanteId}`, async () => {
      try {
        await iniciarFalaSemLimiteOperador(sessao.id, { visitanteId });
        await reconcilePainel?.();
        toast.success("Orador em tribuna (sem tempo) — visível no OBS.");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível iniciar a fala."));
        await reconcilePainel?.();
      }
    });
  };

  const handleAtender = async (id: string) => {
    if (isOptimisticPainelSolicitacaoId(id)) {
      toast.error("Aguarde um instante até o pedido sincronizar com o servidor antes de dar a palavra.");
      await reconcilePainel?.();
      return;
    }
    const k = `atender:${id}`;
    setSolicitacoesOcultas((prev) => new Set(prev).add(id));
    await withBusy(k, async () => {
      try {
        await atenderSolicitacao(id);
        await reconcilePainel?.();
        toast.success("Orador atendido!");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Ocorreu um erro."));
        await reconcilePainel?.();
      } finally {
        setSolicitacoesOcultas((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  };

  const handleIniciarVotacao = async (proposicao: ProposicaoLike) => {
    await withBusy("votacao", async () => {
      try {
        await iniciarVotacao(sessao.id, proposicao.id);
        toast.success("Votação iniciada!");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Ocorreu um erro."));
      }
    });
  };

  const itemJaVotado = (item: OrdemDoDiaItemLike) => {
    const statusDiscussao = String(item?.status_discussao || "").toUpperCase();
    const statusProposicao = String(item?.proposicao?.status || "").toUpperCase();
    return (
      statusDiscussao === "VOTADA_APROVADA" ||
      statusDiscussao === "VOTADA_REJEITADA" ||
      statusProposicao === "APROVADO" ||
      statusProposicao === "REJEITADO"
    );
  };

  const handleSolicitarInicioVotacao = async (item: OrdemDoDiaItemLike) => {
    if (itemJaVotado(item)) {
      setReabrirVotacaoItem(item);
      return;
    }
    await handleIniciarVotacao(item.proposicao);
  };

  const handleConfirmarReaberturaVotacao = async () => {
    if (!reabrirVotacaoItem?.proposicao) return;
    await withBusy("votacao", async () => {
      try {
        await iniciarVotacao(sessao.id, reabrirVotacaoItem.proposicao.id);
        toast.success("Nova votação iniciada para a matéria.");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível iniciar nova votação."));
        throw error;
      }
    });
  };

  const handleEncerrarVotacao = async () => {
    if (!votacaoAtiva) return;
    await withBusy("votacao", async () => {
      try {
        const res = await encerrarVotacao(votacaoAtiva.id, sessao.id);
        toast.success(`Votação encerrada! Resultado: ${res.resultado}`);
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Ocorreu um erro."));
      }
    });
  };

  const handleReiniciarVotacao = async () => {
    if (!votacaoAtiva) return;
    await withBusy("votacao", async () => {
      try {
        await reiniciarVotacaoAberta(votacaoAtiva.id, sessao.id);
        toast.success("Votação reiniciada: placar zerado. Os parlamentares podem votar de novo.");
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível reiniciar a votação."));
        throw error;
      }
    });
  };

  const handleAbrirSessao = async () => {
    await withBusy("abrirSessao", async () => {
      try {
        await updateStatusSessao(sessao.id, "ABERTA");
        toast.success("Sessão aberta com sucesso!");
        await reconcilePainel?.();
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Ocorreu um erro."));
      }
    });
  };

  const handleAdicionarNaFilaPauta = async (vereadorId: string) => {
    mergeOptimisticSolicitacao?.(vereadorId, "DISCURSO");
    await withBusy(`fila-v:${vereadorId}`, async () => {
      try {
        await solicitarPalavraOperador(sessao.id, vereadorId, "DISCURSO");
        toast.success("Vereador adicionado à fila da pauta.");
        await reconcilePainel?.();
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível adicionar na fila."));
        await reconcilePainel?.();
      }
    });
  };

  const handleAdicionarVisitanteNaFilaPauta = async (vt: {
    id: string;
    nome_completo: string;
    foto_url?: string | null;
    representacao?: string | null;
  }) => {
    mergeOptimisticSolicitacaoVisitante?.(vt);
    await withBusy(`fila-vt:${vt.id}`, async () => {
      try {
        await solicitarPalavraOperadorVisitante(sessao.id, vt.id, "DISCURSO");
        toast.success("Orador adicionado à fila da pauta.");
        await reconcilePainel?.();
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível adicionar na fila."));
        await reconcilePainel?.();
      }
    });
  };

  const solicitacoesPendentes = solicitacoes.filter((s) => {
    if (solicitacoesOcultasPendentes.has(s.id)) return false;
    return String(s.status ?? "").trim().toUpperCase() === "PENDENTE";
  });

  const filaPautaPalavra = solicitacoesPendentes.filter((s) => String(s.tipo ?? "").toUpperCase() === "DISCURSO");
  const filaApartesEMesa = solicitacoesPendentes.filter((s) =>
    ["APARTE", "QUESTAO_ORDEM"].includes(String(s.tipo ?? "").toUpperCase())
  );
  const segundosOratoria = oradorAtual?.updated_at
    ? Math.max(0, Math.floor((agora - new Date(oradorAtual.updated_at).getTime()) / 1000))
    : 0;
  const oratoriaMin = String(Math.floor(segundosOratoria / 60)).padStart(2, "0");
  const oratoriaSeg = String(segundosOratoria % 60).padStart(2, "0");
  const semLimiteTempo =
    Boolean(oratoriaTimer?.semLimiteTempo) ||
    (!!oradorAtual && isOradorPresidenteMesa(oradorAtual));
  const durationSec = Number(oratoriaTimer?.durationSec ?? 600);
  const isRunning = Boolean(oratoriaTimer?.isRunning);
  const tempo = semLimiteTempo
    ? 0
    : computeTempoRestanteOratoriaSec(oratoriaTimer, agora, oratoriaClockSkewMs ?? 0);
  const tempoMin = String(Math.floor(tempo / 60)).padStart(2, "0");
  const tempoSeg = String(tempo % 60).padStart(2, "0");
  const tempoFinalizando = !semLimiteTempo && tempo <= 60;
  const tempoParado = !semLimiteTempo && !isRunning && tempo > 0;
  const pausedEntries: Array<{ solicitacaoId: string; remainingSec: number }> = Array.isArray(oratoriaTimer?.pausedEntries)
    ? oratoriaTimer.pausedEntries
    : [];
  const timerVisualClass = !oradorAtual
    ? "bg-slate-100 dark:bg-white/10 border border-border text-slate-500"
    : semLimiteTempo
      ? "bg-slate-700 dark:bg-slate-800 text-white border border-slate-500/40"
      : tempoFinalizando
        ? "bg-red-600 text-white border border-red-500 shadow-red-600/30"
        : tempoParado
          ? "bg-amber-500 text-white border border-amber-400 shadow-amber-500/30"
          : "bg-emerald-600 text-white border border-emerald-500 shadow-emerald-600/30";

  useOratoriaLastMinuteAlert({
    enabled: Boolean(oradorAtual && !semLimiteTempo),
    tempoSec: tempo,
    isRunning,
    semLimiteTempo,
    speakerSolicitacaoId: oratoriaTimer?.speakerSolicitacaoId ?? null,
  });

  const handleTimerAction = async (action: "START" | "STOP" | "RESET") => {
    if (!oradorAtual || !sessao?.id) return;
    await withBusy("timerOratoria", async () => {
      try {
        await controlarTimerOratoria(sessao.id, action);
        await reconcilePainel?.();
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível controlar o timer."));
      }
    });
  };

  const handleConcluirFalaAtual = async () => {
    if (!oradorAtual || !sessao?.id) return;
    await withBusy("concluirFala", async () => {
      try {
        const result = await concluirFalaAtual(sessao.id);
        toast.success(
          result?.resumed
            ? "Aparte encerrado. Orador anterior retomado."
            : "Palavra limpa. Nenhum orador em fala."
        );
        await reconcilePainel?.();
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível concluir a fala atual."));
      }
    });
  };

  const handleAjustarMinutos = async (minutesDelta: number) => {
    if (!sessao?.id || !oradorAtual) return;
    await withBusy("timerOratoria", async () => {
      try {
        await ajustarTimerOratoria(sessao.id, minutesDelta * 60);
        const sinal = minutesDelta > 0 ? "+" : "";
        toast.success(`Tempo ajustado: ${sinal}${minutesDelta} min.`);
        await reconcilePainel?.();
      } catch (error: unknown) {
        if (reloadOnceIfStaleClientServerAction(error)) return;
        toast.error(getErrorMessage(error, "Não foi possível ajustar o tempo."));
      }
    });
  };

  const timerBusy = isPending("timerOratoria");

  return (
    <>
    <div className="h-full min-h-0 min-w-0 w-full max-w-full flex flex-col">
      <div className="flex-1 min-h-0 h-full grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-1 gap-3 lg:gap-4 lg:items-stretch lg:min-h-0">
        {/* Esquerda: votação + pauta (única rolagem aqui: ordem do dia) */}
        <div className="lg:col-span-4 flex flex-col gap-3 min-h-0 min-w-0 lg:h-full">
          <div className="premium-panel p-4 rounded-xl border border-border shadow-lg shrink-0">
            <h2 className="text-foreground font-black uppercase tracking-widest text-[10px] mb-3 flex items-center gap-2">
              <Vote size={16} className="text-blue-600 dark:text-blue-400 shrink-0" /> Votação
            </h2>

            {votacaoAtiva ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-600/5 rounded-lg border border-blue-600/20">
                  <h3 className="text-foreground font-black uppercase tracking-tight text-[10px] mb-2 opacity-80">Placar</h3>
                  <div className="flex justify-between items-center gap-2 px-1">
                    <div className="text-center min-w-0 flex-1">
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider mb-0.5">Sim</p>
                      <p className="text-2xl font-black text-foreground tabular-nums">{votos.filter((v) => v.voto === "SIM").length}</p>
                    </div>
                    <div className="h-8 w-px bg-border shrink-0" />
                    <div className="text-center min-w-0 flex-1">
                      <p className="text-[9px] text-red-600 dark:text-red-400 font-black uppercase tracking-wider mb-0.5">Não</p>
                      <p className="text-2xl font-black text-foreground tabular-nums">{votos.filter((v) => v.voto === "NAO").length}</p>
                    </div>
                    <div className="h-8 w-px bg-border shrink-0" />
                    <div className="text-center min-w-0 flex-1">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-0.5">Abs</p>
                      <p className="text-2xl font-black text-foreground tabular-nums">{votos.filter((v) => v.voto === "ABSTENCAO").length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setReiniciarVotacaoModalOpen(true)}
                    disabled={isPending("votacao")}
                    className="w-full py-2.5 border border-amber-600/40 bg-amber-600/10 hover:bg-amber-600/20 text-amber-900 dark:text-amber-100 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isPending("votacao") ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 shrink-0" />
                    )}
                    Reiniciar votação
                  </button>
                  <button
                    type="button"
                    onClick={handleEncerrarVotacao}
                    disabled={isPending("votacao")}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isPending("votacao") ? <Loader2 className="animate-spin h-4 w-4" /> : "Encerrar votação"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 px-3 text-center border border-dashed border-border rounded-lg bg-slate-50 dark:bg-white/5">
                <Vote size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider leading-snug">
                  Inicie a votação com «Votar» num item da pauta abaixo
                </p>
              </div>
            )}
          </div>

          <div className="premium-panel rounded-xl border border-border p-4 shadow-lg flex flex-col flex-1 min-h-[200px] lg:min-h-0 min-w-0">
            <h2 className="text-foreground font-black uppercase tracking-widest text-[10px] mb-3 flex items-center gap-2 shrink-0">
              <ClipboardList size={16} className="text-blue-600 dark:text-blue-400 shrink-0" /> Ordem do dia
            </h2>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-2 pr-1 overscroll-contain">
              {ordemDoDia.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center opacity-30">
                  <ClipboardList size={36} className="mb-2" />
                  <p className="text-[9px] uppercase font-black tracking-widest">Pauta vazia</p>
                </div>
              ) : (
                ordemDoDia.map((item) => {
                  const manual = isProposicaoPautaManual(item.proposicao?.texto_completo);
                  const rotuloRef = manual
                    ? "Pauta manual"
                    : `${item.proposicao.tipo} ${item.proposicao.numero != null ? `${item.proposicao.numero}/` : ""}${item.proposicao.ano}`;
                  return (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-border hover:border-blue-500/40 transition-colors group shadow-sm min-w-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                        {manual ? (
                          <span className="rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider border border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-200">
                            Manual
                          </span>
                        ) : null}
                        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-wide break-words min-w-0">
                          {rotuloRef}
                        </span>
                        {String(item.status_discussao || "").toUpperCase() === "VOTADA_APROVADA" && (
                          <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border border-emerald-500/30 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
                            Aprovado
                          </span>
                        )}
                        {String(item.status_discussao || "").toUpperCase() === "VOTADA_REJEITADA" && (
                          <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border border-red-500/30 bg-red-600/15 text-red-700 dark:text-red-300">
                            Rejeitado
                          </span>
                        )}
                      </div>
                      {votacaoAtiva ? null : (
                        <button
                          type="button"
                          onClick={() => handleSolicitarInicioVotacao(item)}
                          disabled={isPending("votacao")}
                          className="shrink-0 bg-blue-600 text-[10px] font-black uppercase tracking-wider text-white px-3.5 py-1.5 rounded-lg transition-opacity md:opacity-0 md:group-hover:opacity-100 shadow-md active:scale-95 inline-flex items-center justify-center gap-1.5 min-w-[4.5rem] disabled:pointer-events-none disabled:opacity-50"
                        >
                          {isPending("votacao") ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : null}
                          Votar
                        </button>
                      )}
                    </div>
                    <p className="text-foreground text-[11px] font-semibold line-clamp-2 mt-1.5 leading-snug break-words">
                      {item.proposicao.ementa}
                    </p>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Centro: vereadores + fila da pauta lado a lado (mais largura para cada card de parlamentar) */}
        <div className="lg:col-span-5 flex flex-col lg:flex-row gap-3 min-h-0 min-w-0 lg:h-full lg:items-stretch">
          <div className="premium-panel rounded-xl border border-border p-4 shadow-lg flex flex-col flex-1 min-w-0 min-h-[260px] lg:min-h-0 lg:h-full">
          <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <h2 className="text-foreground font-black uppercase tracking-widest text-[10px] flex items-center gap-2 min-w-0">
              <UserCheck size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">Vereadores</span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setTvAppModalOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-slate-50 dark:bg-white/5 text-[9px] font-black uppercase tracking-wider text-foreground hover:border-blue-500/40 transition-colors"
                title="Instalar painel como aplicação web (PWA) na TV ou tablet"
              >
                <Tv size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                Painel TV (PWA)
              </button>
              <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded-full border border-blue-500/20 tabular-nums">
                {sessao.presencas?.filter((p) => p.status !== "AUSENTE").length} / {vereadores.length}
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 overscroll-contain">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {vereadores.map((v) => {
                const presenca = sessao.presencas?.find((p) => p.vereador_id === v.id);
                const isPresente = presenca && presenca.status !== "AUSENTE";
                const votoAtual = votos.find((vt) => vt.vereador_id === v.id)?.voto as
                  | "SIM"
                  | "NAO"
                  | "ABSTENCAO"
                  | undefined;

                return (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center justify-between gap-2 p-2 rounded-lg border transition-all shadow-sm min-w-0",
                      isPresente ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-50 dark:bg-white/5 border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Image
                          src={v.foto_url ?? "/placeholder-user.jpg"}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className={cn(
                            "w-9 h-9 rounded-lg object-cover shadow-sm",
                            !isPresente && "grayscale opacity-40"
                          )}
                        />
                        {isPresente && (
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-panel" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground text-[11px] font-bold uppercase tracking-tight leading-tight truncate">
                          {v.nome_parlamentar || v.nome}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                          <p className="text-slate-500 text-[8px] uppercase font-bold tracking-wider truncate">{v.partido}</p>
                          <span
                            className={cn(
                              "shrink-0 px-1.5 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider",
                              !votacaoAtiva
                                ? "bg-slate-100 dark:bg-white/5 text-slate-500 border-border"
                                : !isPresente
                                  ? "bg-slate-100 dark:bg-white/5 text-slate-500 border-border"
                                  : votoAtual === "SIM"
                                    ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : votoAtual === "NAO"
                                      ? "bg-red-600/15 text-red-700 dark:text-red-300 border-red-500/30"
                                      : votoAtual === "ABSTENCAO"
                                        ? "bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                        : "bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-500/25"
                            )}
                          >
                            {!votacaoAtiva
                              ? "Sem votação"
                              : !isPresente
                                ? "Ausente"
                                : votoAtual === "SIM"
                                  ? "Voto: Sim"
                                  : votoAtual === "NAO"
                                    ? "Voto: Não"
                                    : votoAtual === "ABSTENCAO"
                                      ? "Voto: Abs"
                                      : "Aguardando"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAdicionarNaFilaPauta(v.id)}
                        disabled={isPending(`fila-v:${v.id}`)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-blue-500/30 bg-blue-600/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                        title="Adicionar este vereador à fila da pauta"
                        aria-label={`Adicionar ${v.nome_parlamentar || v.nome} na fila da pauta`}
                      >
                        {isPending(`fila-v:${v.id}`) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Plus size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIniciarFalaSemLimiteVereador(v.id)}
                        disabled={isPending(`sem-limite-v:${v.id}`) || isPending(`fila-v:${v.id}`)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-indigo-500/35 bg-indigo-600/10 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                        title="Colocar em fala agora, sem limite de tempo (OBS / expediente)"
                        aria-label={`${v.nome_parlamentar || v.nome} em fala sem tempo`}
                      >
                        {isPending(`sem-limite-v:${v.id}`) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Infinity size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarcarPresenca(v.id)}
                        disabled={presencaPendingId === v.id}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wide transition-all active:scale-95 inline-flex items-center justify-center gap-1 min-w-[4.25rem] disabled:pointer-events-none disabled:opacity-60",
                          isPresente
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-500 hover:text-foreground border border-border"
                        )}
                      >
                        {presencaPendingId === v.id ? (
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
                        ) : isPresente ? (
                          "Presente"
                        ) : (
                          "Marcar"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-border space-y-2 shrink-0">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Mic2 size={12} className="text-violet-500 shrink-0" />
                Oradores externos (tribuna)
              </h3>
              {visitantesTribuna.length === 0 ? (
                <p className="text-[8px] text-slate-500 dark:text-slate-400 font-semibold leading-snug">
                  Cadastre em Oradores e marque &quot;Disponível na tribuna&quot; para aparecer aqui e na fila da pauta.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                  {visitantesTribuna.map((vt) => (
                    <div
                      key={vt.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-violet-500/20 bg-violet-500/5 shadow-sm min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {vt.foto_url ? (
                          <Image src={vt.foto_url} alt="" width={36} height={36} unoptimized className="w-9 h-9 rounded-lg object-cover shrink-0 border border-violet-500/25" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                            {String(vt.nome_completo || "?")
                              .trim()
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w: string) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "?"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-foreground text-[11px] font-bold uppercase tracking-tight leading-tight truncate">
                            {vt.nome_completo}
                          </p>
                          {vt.representacao ? (
                            <p className="text-slate-500 text-[8px] uppercase font-bold tracking-wider truncate">{vt.representacao}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdicionarVisitanteNaFilaPauta(vt)}
                          disabled={isPending(`fila-vt:${vt.id}`)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-violet-500/35 bg-violet-600/15 text-violet-800 dark:text-violet-200 hover:bg-violet-600 hover:text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                          title="Adicionar à fila da pauta"
                          aria-label={`Adicionar ${vt.nome_completo} na fila da pauta`}
                        >
                          {isPending(`fila-vt:${vt.id}`) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Plus size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIniciarFalaSemLimiteVisitante(vt.id)}
                          disabled={isPending(`sem-limite-vt:${vt.id}`) || isPending(`fila-vt:${vt.id}`)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-indigo-500/35 bg-indigo-600/10 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                          title="Colocar em fala agora, sem limite de tempo (OBS)"
                          aria-label={`${vt.nome_completo} em fala sem tempo`}
                        >
                          {isPending(`sem-limite-vt:${vt.id}`) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Infinity size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>

          <div className="premium-panel flex w-full max-h-[45vh] shrink-0 flex-col rounded-xl border border-blue-500/15 p-4 shadow-lg min-h-[200px] lg:h-full lg:max-h-none lg:min-h-0 lg:w-[min(100%,288px)] xl:w-[300px]">
            <h2 className="text-foreground font-black uppercase tracking-widest text-[10px] mb-1 shrink-0 flex items-center gap-2">
              <Mic2 size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              Fila da pauta
            </h2>
            <p className="text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide mb-2 leading-tight shrink-0">
              Palavra na ordem do dia
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-2 pr-1 overscroll-contain">
              {filaPautaPalavra.length === 0 ? (
                <div className="py-4 flex flex-col items-center justify-center opacity-25">
                  <Mic2 size={28} className="mb-1" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-center">Ninguém na fila da pauta</p>
                </div>
              ) : (
                filaPautaPalavra.map((sol) => (
                  <div
                    key={sol.id}
                    className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-border flex items-center justify-between gap-2 group shadow-sm min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {sol.visitante?.foto_url || sol.vereador?.foto_url ? (
                        <Image
                          src={fotoOradorSolicitacao(sol, vereadores)}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                          {iniciaisOradorSolicitacao(sol)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-foreground text-[9px] font-black uppercase tracking-tight truncate">
                          {nomeOradorSolicitacao(sol)}
                        </p>
                        <span className="text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-wider block truncate">
                          {labelTipoSolicitacao(sol.tipo)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAtender(sol.id)}
                        disabled={isOptimisticPainelSolicitacaoId(sol.id) || isPending(`atender:${sol.id}`)}
                        className="p-1.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-600 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center min-w-[2rem] min-h-[2rem]"
                        title={
                          isOptimisticPainelSolicitacaoId(sol.id)
                            ? "A sincronizar com o servidor…"
                            : isPending(`atender:${sol.id}`)
                              ? "A processar…"
                              : "Aceitar — dar a palavra"
                        }
                        type="button"
                      >
                        {isPending(`atender:${sol.id}`) ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        ) : (
                          <Check size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleAtenderSemLimite(sol.id)}
                        disabled={
                          isOptimisticPainelSolicitacaoId(sol.id) ||
                          isPending(`atender:${sol.id}`) ||
                          isPending(`atender-sem-limite:${sol.id}`)
                        }
                        className="p-1.5 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center min-w-[2rem] min-h-[2rem]"
                        title="Aceitar sem limite de tempo (OBS / expediente)"
                        type="button"
                      >
                        {isPending(`atender-sem-limite:${sol.id}`) ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        ) : (
                          <Infinity size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => setRecusarModalId(sol.id)}
                        disabled={isOptimisticPainelSolicitacaoId(sol.id) || isPending(`atender:${sol.id}`)}
                        className="p-1.5 bg-red-600/10 text-red-600 dark:text-red-400 rounded-md hover:bg-red-600 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        title={
                          isOptimisticPainelSolicitacaoId(sol.id)
                            ? "A sincronizar com o servidor…"
                            : isPending(`atender:${sol.id}`)
                              ? "Aguarde o pedido em curso…"
                              : "Recusar pedido"
                        }
                        type="button"
                      >
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Direita: cronômetro + fila apartes (fila da pauta ao centro, ao lado dos vereadores) */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 min-w-0 lg:h-full">
          <div className="premium-panel p-4 rounded-xl border border-border shadow-lg shrink-0">
            <h2 className="text-foreground font-black uppercase tracking-widest text-[10px] mb-3 flex items-center gap-2">
              <Mic2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0" /> Palavra
            </h2>
            <p className="text-[8px] text-slate-500 dark:text-slate-400 font-semibold leading-snug mb-2">
              Botão <Infinity className="inline h-3 w-3 align-[-2px]" aria-hidden /> na lista de vereadores: fala sem tempo (expediente, leitura pela mesa) — aparece no OBS como orador atual.
            </p>
            <div className="py-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-border mb-3 px-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Orador atual</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-tight text-foreground truncate">
                  {oradorAtual ? nomeOradorSolicitacao(oradorAtual) : "Nenhum orador em andamento"}
                </p>
                <span className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-2xl font-mono font-black tabular-nums tracking-tight shadow-sm",
                  semLimiteTempo && oradorAtual && "text-sm font-black tracking-wide normal-case px-2 py-1.5",
                  timerVisualClass
                )}>
                  {oradorAtual
                    ? semLimiteTempo
                      ? "Sem limite"
                      : `${tempoMin}:${tempoSeg}`
                    : `${oratoriaMin}:${oratoriaSeg}`}
                </span>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleTimerAction("START")}
                disabled={!oradorAtual || timerBusy || semLimiteTempo || tempo === 0}
                className={cn(
                  "p-2.5 rounded-lg transition-all shadow active:scale-95 disabled:opacity-50 inline-flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem]",
                  isRunning
                    ? "bg-emerald-600 text-white shadow-emerald-600/20"
                    : "bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-emerald-500 border border-border"
                )}
                title="Iniciar"
                type="button"
              >
                {timerBusy ? <Loader2 className="h-[18px] w-[18px] animate-spin shrink-0" aria-hidden /> : <Play size={18} fill={isRunning ? "currentColor" : "none"} />}
              </button>
              <button
                onClick={() => handleTimerAction("STOP")}
                disabled={!oradorAtual || semLimiteTempo || timerBusy}
                className={cn(
                  "p-2.5 rounded-lg transition-all shadow active:scale-95 disabled:opacity-50 inline-flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem]",
                  !semLimiteTempo && !isRunning && durationSec > 0 && tempo < durationSec
                    ? "bg-amber-500 text-white shadow-amber-500/20"
                    : "bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-red-500 border border-border"
                )}
                title="Parar"
                type="button"
              >
                {timerBusy ? <Loader2 className="h-[18px] w-[18px] animate-spin shrink-0" aria-hidden /> : <Square size={18} fill={!semLimiteTempo && !isRunning && durationSec > 0 && tempo < durationSec ? "currentColor" : "none"} />}
              </button>
              <button
                onClick={() => handleTimerAction("RESET")}
                disabled={!oradorAtual || semLimiteTempo || timerBusy}
                className="p-2.5 bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all border border-border shadow active:scale-95 disabled:opacity-50 inline-flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem]"
                title="Reiniciar"
                type="button"
              >
                {timerBusy ? <Loader2 className="h-[18px] w-[18px] animate-spin shrink-0" aria-hidden /> : <RotateCcw size={18} />}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[3, 5, 10].map((m) => (
                <button
                  key={`plus-${m}`}
                  type="button"
                  onClick={() => handleAjustarMinutos(m)}
                  disabled={!oradorAtual || semLimiteTempo || timerBusy}
                  className="rounded-md border border-emerald-500/35 bg-emerald-600/10 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1 min-h-[2rem]"
                >
                  {timerBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : `+${m}`}
                </button>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {[3, 5, 10].map((m) => (
                <button
                  key={`minus-${m}`}
                  type="button"
                  onClick={() => handleAjustarMinutos(-m)}
                  disabled={!oradorAtual || semLimiteTempo || timerBusy}
                  className="rounded-md border border-red-500/35 bg-red-600/10 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1 min-h-[2rem]"
                >
                  {timerBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : `-${m}`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleConcluirFalaAtual}
              disabled={!oradorAtual || isPending("concluirFala")}
              className="mt-2 w-full rounded-lg border border-purple-500/30 bg-purple-600/10 py-2 text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {isPending("concluirFala") ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : null}
              {isPending("concluirFala") ? "A processar…" : "Concluir fala atual"}
            </button>
            {pausedEntries.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Falas pausadas
                </p>
                {pausedEntries.map((entry) => {
                  const solicitacao = solicitacoes.find((s) => s.id === entry.solicitacaoId);
                  return (
                    <div key={entry.solicitacaoId} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-tight text-foreground truncate">
                        {solicitacao ? nomeOradorSolicitacao(solicitacao) : "Orador"}
                      </span>
                      <span className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500 text-white px-2 py-0.5 text-[10px] font-mono font-black tabular-nums">
                        {formatSeconds(entry.remainingSec)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="premium-panel rounded-xl border border-border p-4 shadow-lg flex flex-col flex-1 min-h-[120px] lg:min-h-0 min-w-0 overflow-hidden border-amber-500/15">
            <h2 className="text-foreground font-black uppercase tracking-widest text-[10px] mb-1 shrink-0 flex items-center gap-2">
              <HelpCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              Apartes / mesa
            </h2>
            <p className="text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide mb-2 leading-tight shrink-0">
              Durante a palavra de outro parlamentar
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-2 pr-1 overscroll-contain">
              {filaApartesEMesa.length === 0 ? (
                <div className="py-4 flex flex-col items-center justify-center opacity-25">
                  <HelpCircle size={28} className="mb-1 text-amber-600/50" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-center">Sem apartes ou questões de ordem</p>
                </div>
              ) : (
                filaApartesEMesa.map((sol) => (
                  <div
                    key={sol.id}
                    className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-border flex items-center justify-between gap-2 group shadow-sm min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {sol.visitante?.foto_url || sol.vereador?.foto_url ? (
                        <Image
                          src={fotoOradorSolicitacao(sol, vereadores)}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                          {iniciaisOradorSolicitacao(sol)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-foreground text-[9px] font-black uppercase tracking-tight truncate">
                          {nomeOradorSolicitacao(sol)}
                        </p>
                        <span className="text-amber-700 dark:text-amber-300 text-[8px] font-black uppercase tracking-wider block truncate">
                          {labelTipoSolicitacao(sol.tipo)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAtender(sol.id)}
                        disabled={isOptimisticPainelSolicitacaoId(sol.id) || isPending(`atender:${sol.id}`)}
                        className="p-1.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-600 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center min-w-[2rem] min-h-[2rem]"
                        title={
                          isOptimisticPainelSolicitacaoId(sol.id)
                            ? "A sincronizar com o servidor…"
                            : isPending(`atender:${sol.id}`)
                              ? "A processar…"
                              : "Aceitar na mesa"
                        }
                        type="button"
                      >
                        {isPending(`atender:${sol.id}`) ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                        ) : (
                          <Check size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => setRecusarModalId(sol.id)}
                        disabled={isOptimisticPainelSolicitacaoId(sol.id) || isPending(`atender:${sol.id}`)}
                        className="p-1.5 bg-red-600/10 text-red-600 dark:text-red-400 rounded-md hover:bg-red-600 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        title={
                          isOptimisticPainelSolicitacaoId(sol.id)
                            ? "A sincronizar com o servidor…"
                            : isPending(`atender:${sol.id}`)
                              ? "Aguarde o pedido em curso…"
                              : "Recusar pedido"
                        }
                        type="button"
                      >
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="shrink-0">
            {sessao.status === "AGENDADA" ? (
              <button
                onClick={handleAbrirSessao}
                disabled={isPending("abrirSessao")}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                type="button"
              >
                {isPending("abrirSessao") ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                {isPending("abrirSessao") ? "A abrir…" : "Abrir sessão"}
              </button>
            ) : (
              sessao.status !== "ENCERRADA" && (
                <button
                  onClick={() => setEncerrarModalOpen(true)}
                  className="w-full py-3 bg-red-600/10 hover:bg-red-600 border border-red-600/30 text-red-600 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  type="button"
                >
                  <Power size={16} /> Encerrar sessão
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>

    <BlockingModal
      isOpen={recusarModalId !== null}
      onClose={() => setRecusarModalId(null)}
      mode="confirm"
      danger
      title="Recusar pedido?"
      message="O pedido sairá da fila e o parlamentar poderá solicitar novamente se necessário."
      confirmLabel="Recusar"
      cancelLabel="Voltar"
      onConfirm={async () => {
        if (!recusarModalId) return;
        const id = recusarModalId;
        if (isOptimisticPainelSolicitacaoId(id)) {
          toast.error("Aguarde a sincronização do painel antes de recusar este pedido.");
          setRecusarModalId(null);
          await reconcilePainel?.();
          return;
        }
        setSolicitacoesOcultas((prev) => new Set(prev).add(id));
        try {
          await recusarSolicitacao(id);
          await reconcilePainel?.();
          setSolicitacoesOcultas((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.success("Pedido recusado.");
        } catch (error: unknown) {
          setSolicitacoesOcultas((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          if (reloadOnceIfStaleClientServerAction(error)) return;
          toast.error(getErrorMessage(error, "Não foi possível recusar."));
          await reconcilePainel?.();
          throw error;
        }
      }}
    />

    <BlockingModal
      isOpen={reiniciarVotacaoModalOpen}
      onClose={() => setReiniciarVotacaoModalOpen(false)}
      mode="confirm"
      danger
      title="Reiniciar votação?"
      message="Todos os votos já registrados nesta rodada serão apagados. A mesma matéria permanece em votação e os parlamentares poderão votar novamente. Use apenas em caso de erro ou orientação da mesa."
      confirmLabel="Reiniciar placar"
      cancelLabel="Cancelar"
      onConfirm={handleReiniciarVotacao}
    />

    <BlockingModal
      isOpen={reabrirVotacaoItem !== null}
      onClose={() => setReabrirVotacaoItem(null)}
      mode="confirm"
      title="Matéria já votada. Abrir nova votação?"
      message="Esta matéria já possui resultado registrado na sessão. Ao abrir nova votação, uma nova rodada será criada e o resultado final exibido no painel poderá ser atualizado ao encerrar essa nova rodada."
      confirmLabel="Abrir nova votação"
      cancelLabel="Cancelar"
      onConfirm={handleConfirmarReaberturaVotacao}
    />

    <BlockingModal
      isOpen={tvAppModalOpen}
      onClose={() => setTvAppModalOpen(false)}
      mode="alert"
      title="Painel na TV (PWA)"
      message={
        <div className="space-y-4 text-left text-foreground">
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            Não é necessário aplicativo nativo. No <strong>Chrome</strong> (ou navegador baseado em Chromium) na
            TV ou no equipamento que exibe o plenário, abra <strong>este mesmo site</strong> com o endereço da
            câmara (subdomínio), faça login e vá a <strong>Painel TV</strong>.
          </p>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground font-medium leading-relaxed">
            <li>
              Abra o menu do navegador (três pontos ou equivalente) e escolha{" "}
              <strong className="text-foreground">Instalar aplicação</strong>,{" "}
              <strong className="text-foreground">Instalar SysLegis</strong> ou{" "}
              <strong className="text-foreground">Adicionar ao ecrã inicial</strong> (o texto varia por aparelho).
            </li>
            <li>
              Abra o ícone instalado: o arranque em modo <strong className="text-foreground">standalone</strong>{" "}
              oculta barras do browser, ideal para sala de sessões.
            </li>
            <li>
              O painel em <strong className="text-foreground">/painel/tv</strong> mantém atualização em tempo real
              (SSE) como no separador normal; o ecrã tenta permanecer ligado enquanto o painel TV estiver visível.
            </li>
          </ol>
          <a
            href="/painel/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-500"
          >
            Abrir Painel TV nesta câmara
          </a>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Requer <strong className="text-foreground">HTTPS</strong>. Em Android TV use o Chrome a partir da Play
            Store se o browser do sistema não oferecer instalação.
          </p>
        </div>
      }
    />

    <BlockingModal
      isOpen={encerrarModalOpen}
      onClose={() => setEncerrarModalOpen(false)}
      mode="confirm"
      danger
      title="Encerrar sessão?"
      message="Confirme que deseja encerrar a sessão plenária. Esta ação pode afetar painéis e registros em andamento."
      confirmLabel="Encerrar sessão"
      cancelLabel="Cancelar"
      onConfirm={async () => {
        try {
          await updateStatusSessao(sessao.id, "ENCERRADA");
          toast.success("Sessão encerrada!");
        } catch (error: unknown) {
          if (reloadOnceIfStaleClientServerAction(error)) return;
          toast.error(getErrorMessage(error, "Erro ao encerrar."));
          throw error;
        }
      }}
    />
    </>
  );
}
