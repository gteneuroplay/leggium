'use client';

import { useCallback, useEffect, useState } from "react";
import { Gavel, Mic2, FileText, ListOrdered, Vote, Loader2, Info, HelpCircle, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { rotuloAutoriaProposicao } from "@/lib/proposicao-autoria";
import { nomeOradorSolicitacao, compareSolicitacaoCreatedAsc, pickOradorEmFala, isOradorPresidenteMesa } from "@/lib/painel/orador-display";
import { toast } from "react-hot-toast";
import { aplicarVotoMinerva, avancarOrdemDoDia, iniciarVotacao, solicitarPalavra, registrarVoto } from "../actions";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { reloadOnceIfStaleClientServerAction } from "@/lib/next-stale-server-action";
import { useOratoriaLastMinuteAlert } from "@/hooks/use-oratoria-last-minute-alert";
import { computeTempoRestanteOratoriaSec } from "@/lib/painel/oratoria-tempo-restante";
import { PainelVereadorMateriaConteudo } from "./PainelVereadorMateria";
import { formatProposicaoTipoLabel } from "@/lib/proposicao-tipo-map";

function rotuloCompletoOpcao(v: "SIM" | "NAO" | "ABSTENCAO") {
  switch (v) {
    case "SIM":
      return "SIM — a favor";
    case "NAO":
      return "NÃO — contra";
    case "ABSTENCAO":
      return "ABSTENÇÃO";
    default:
      return v;
  }
}

export function PainelPresidente({ 
  sessao, 
  vereadores,
  ordemDoDia,
  votacaoAtiva,
  votos,
  solicitacoes = [],
  oratoriaTimer,
  oratoriaClockSkewMs = 0,
  mesaToken = null,
  userProfile,
  mergeOptimisticVoto,
  reconcilePainel,
  sessionVereadorId = null,
}: { 
  sessao: any; 
  vereadores: any[]; 
  ordemDoDia: any[];
  votacaoAtiva: any;
  votos: any[];
  solicitacoes?: any[];
  oratoriaTimer?: any;
  oratoriaClockSkewMs?: number;
  mesaToken?: string | null;
  userProfile?: any;
  mergeOptimisticVoto?: (votacaoId: string, vereadorId: string, voto: "SIM" | "NAO" | "ABSTENCAO") => void;
  reconcilePainel?: () => Promise<void>;
  /** Resolvido no servidor (perfil + `vereadores.user_id`); garante voto no painel do presidente. */
  sessionVereadorId?: string | null;
}) {
  const statusDiscussao = (item: { status_discussao?: string }) =>
    String(item?.status_discussao ?? "").toUpperCase();

  const itemPautaEmVotacao = votacaoAtiva
    ? ordemDoDia.find((i) => i.proposicao_id === votacaoAtiva.proposicao_id)
    : null;
  const proposicaoDaPauta =
    itemPautaEmVotacao?.proposicao ??
    ordemDoDia.find((i) => statusDiscussao(i) === "EM_DISCUSSAO")?.proposicao;
  const proposicaoEmDiscussao = votacaoAtiva?.proposicao
    ? { ...proposicaoDaPauta, ...votacaoAtiva.proposicao }
    : proposicaoDaPauta;

  const votacaoComPdf = Boolean(
    votacaoAtiva && proposicaoEmDiscussao?.pdf_url?.trim(),
  );

  const rotuloProposicaoEmFoco = (p: { tipo?: string; numero?: number | null; ano?: number } | null | undefined) => {
    if (!p?.tipo) return "";
    const tipo = formatProposicaoTipoLabel(p.tipo);
    if (p.numero != null && p.ano != null) return `${tipo} ${p.numero}/${p.ano}`;
    if (p.ano != null) return `${tipo} ${p.ano}`;
    return tipo;
  };

  const itemPautaEmDiscussao = ordemDoDia.find((i) => statusDiscussao(i) === "EM_DISCUSSAO");
  const proposicaoIdParaAbrirVotacao = itemPautaEmDiscussao?.proposicao_id ?? null;
  const podeIniciarVotacao = Boolean(!votacaoAtiva && proposicaoIdParaAbrirVotacao);

  const vereadorIdFromLista =
    userProfile?.id
      ? vereadores.find(
          (v: { user_id?: string }) => String(v.user_id ?? "") === String(userProfile.id)
        )?.id
      : undefined;
  const vereadorId =
    sessionVereadorId ||
    userProfile?.vereador_id ||
    userProfile?.vereador?.id ||
    vereadorIdFromLista ||
    null;
  const palavraVereadorOverride =
    userProfile?.role === "ADMIN_MASTER" && vereadorId ? vereadorId : undefined;
  const votoVereadorOverride =
    userProfile?.role === "ADMIN_MASTER" && vereadorId ? vereadorId : undefined;
  const palavraKey = (tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM") => `palavra:${tipo}`;

  const itensPautaOrdenados = [...ordemDoDia].sort(
    (a, b) => Number(a?.ordem_sequencial ?? 0) - Number(b?.ordem_sequencial ?? 0)
  );
  const idxEmDiscussao = itensPautaOrdenados.findIndex((i) => statusDiscussao(i) === "EM_DISCUSSAO");
  const idxEmVotacao = votacaoAtiva
    ? itensPautaOrdenados.findIndex((i) => i.proposicao_id === votacaoAtiva.proposicao_id)
    : -1;
  const indiceDestaque = idxEmVotacao >= 0 ? idxEmVotacao : idxEmDiscussao;
  const rotuloPosicaoPauta =
    indiceDestaque >= 0 ? `${indiceDestaque + 1} de ${itensPautaOrdenados.length}` : `0 de ${itensPautaOrdenados.length}`;

  const getVotoVereador = (vid: string) => {
    const v = votos.find(v => v.vereador_id === vid);
    return v?.voto;
  };

  const meuVotoAtual =
    vereadorId && votacaoAtiva
      ? (votos.find((v: { vereador_id?: string }) => v.vereador_id === vereadorId)?.voto as
          | "SIM"
          | "NAO"
          | "ABSTENCAO"
          | undefined)
      : undefined;

  const ICON_VOTO_PREZ = 28;
  const totalSim = votos.filter(v => v.voto === 'SIM').length;
  const totalNao = votos.filter(v => v.voto === 'NAO').length;
  const totalAbs = votos.filter(v => v.voto === 'ABSTENCAO').length;
  const empate = votacaoAtiva && totalSim === totalNao;
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
  const presidenteAcaoEmCurso =
    isPending("ordemDoDia") || isPending("votoMinerva") || isPending("iniciarVotacao");
  const palavraBusy = (tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM") => isPending(palavraKey(tipo));
  const qualquerPalavraBusy =
    isPending("palavra:DISCURSO") || isPending("palavra:APARTE") || isPending("palavra:QUESTAO_ORDEM");
  const [minervaModalOpen, setMinervaModalOpen] = useState(false);
  const [semOrdemModal, setSemOrdemModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteChoicePending, setVoteChoicePending] = useState<"SIM" | "NAO" | "ABSTENCAO" | null>(null);
  const [votoParaConfirmar, setVotoParaConfirmar] = useState<"SIM" | "NAO" | "ABSTENCAO" | null>(null);
  const [abaPresidente, setAbaPresidente] = useState<"pauta" | "fala" | "votos">("pauta");
  const [agora, setAgora] = useState(Date.now());
  const solicitacoesOrdenadas = [...solicitacoes].sort(compareSolicitacaoCreatedAsc);
  const filaOratoria = solicitacoesOrdenadas.filter(
    (s) => String(s.status ?? "").toUpperCase() === "PENDENTE"
  );
  const oradorAtual = pickOradorEmFala(solicitacoes);
  const semLimiteTempo =
    Boolean(oratoriaTimer?.semLimiteTempo) ||
    (!!oradorAtual && isOradorPresidenteMesa(oradorAtual));
  const isRunning = Boolean(oratoriaTimer?.isRunning);
  const tempo = semLimiteTempo
    ? 0
    : computeTempoRestanteOratoriaSec(oratoriaTimer, agora, oratoriaClockSkewMs ?? 0);
  const oratoriaMin = String(Math.floor(tempo / 60)).padStart(2, "0");
  const oratoriaSeg = String(tempo % 60).padStart(2, "0");
  const tempoFinalizando = !semLimiteTempo && tempo <= 60;
  const tempoParado = !semLimiteTempo && !isRunning && tempo > 0;
  const timerVisualClass = !oradorAtual
    ? "bg-slate-100 dark:bg-white/10 border border-border text-slate-500"
    : semLimiteTempo
      ? "bg-slate-700 dark:bg-slate-800 text-white border border-slate-500/40"
      : tempoFinalizando
        ? "bg-red-600 text-white border border-red-500 shadow-red-600/30"
        : tempoParado
          ? "bg-amber-500 text-white border border-amber-400 shadow-amber-500/30"
          : "bg-emerald-600 text-white border border-emerald-500 shadow-emerald-600/30";

  const statusLabelMap: Record<string, string> = {
    AGUARDANDO: "Aguardando",
    EM_DISCUSSAO: "Em discussão",
    DISCUTIDA: "Discutida",
    VOTADA_APROVADA: "Votada aprovada",
    VOTADA_REJEITADA: "Votada rejeitada",
  };

  const handleOrdemDoDia = async () => {
    if (!sessao?.id) return;

    const temAguardando = ordemDoDia.some((i) => statusDiscussao(i) === "AGUARDANDO");
    if (ordemDoDia.length === 0 || !temAguardando) {
      const detalhe =
        ordemDoDia.length === 0
          ? "A pauta desta sessão está vazia. Inclua matérias na ordem do dia antes de avançar."
          : "Não há itens em estado «aguardando». Todas as matérias da pauta podem já ter sido tratadas ou não há próxima matéria a colocar em discussão.";
      setSemOrdemModal({ open: true, message: detalhe });
      return;
    }

    await withBusy("ordemDoDia", async () => {
      try {
        const res = await avancarOrdemDoDia(sessao.id, mesaToken ?? undefined);
        toast.success(`Item ${res.ordem} em discussão (matéria em foco). Use «Iniciar votação» quando for o momento.`);
      } catch (e: any) {
        if (reloadOnceIfStaleClientServerAction(e)) return;
        const rawMsg = String(e?.message || "");
        if (
          rawMsg.includes("Não há próximo item") ||
          rawMsg.includes("próximo item aguardando")
        ) {
          setSemOrdemModal({
            open: true,
            message:
              "Não há matéria aguardando na ordem do dia para avançar. Verifique a pauta da sessão ou se todas as matérias já foram concluídas.",
          });
          return;
        }
        toast.error(rawMsg || "Não foi possível avançar a ordem do dia.");
      }
    });
  };

  const handleIniciarVotacao = async () => {
    if (!sessao?.id || !proposicaoIdParaAbrirVotacao) return;
    await withBusy("iniciarVotacao", async () => {
      try {
        await iniciarVotacao(sessao.id, proposicaoIdParaAbrirVotacao, mesaToken ?? undefined);
        toast.success("Votação aberta. Os vereadores e a presidência (como vereador) podem registrar o voto.");
      } catch (e: any) {
        if (reloadOnceIfStaleClientServerAction(e)) return;
        toast.error(e?.message || "Não foi possível iniciar a votação.");
      }
    });
  };

  const executarRegistroVoto = async (voto: "SIM" | "NAO" | "ABSTENCAO") => {
    if (!votacaoAtiva || !vereadorId) return;
    mergeOptimisticVoto?.(votacaoAtiva.id, vereadorId, voto);
    setVoteChoicePending(voto);
    setVoteSubmitting(true);
    try {
      await registrarVoto(votacaoAtiva.id, voto, votoVereadorOverride);
      toast.success("Voto registrado com sucesso!");
    } catch (e: any) {
      if (reloadOnceIfStaleClientServerAction(e)) return;
      toast.error(e.message || "Erro ao registrar voto.");
      await reconcilePainel?.();
      throw e;
    } finally {
      setVoteSubmitting(false);
      setVoteChoicePending(null);
    }
  };

  const handleSolicitarPalavra = async (tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM") => {
    if (!sessao?.id) {
      toast.error("Nenhuma sessão ativa para registrar o pedido.");
      return;
    }
    if (!vereadorId) {
      toast.error("Conta sem vínculo de vereador. Use o painel do vereador ou peça o vínculo ao administrador.");
      return;
    }
    const key = palavraKey(tipo);
    await withBusy(key, async () => {
      try {
        await solicitarPalavra(sessao.id, tipo, palavraVereadorOverride);
        if (tipo === "DISCURSO") {
          toast.success("Pedido de palavra na pauta enviado à mesa.");
        } else if (tipo === "APARTE") {
          toast.success("Pedido de aparte enviado à mesa.");
        } else {
          toast.success("Questão de ordem registrada na mesa.");
        }
      } catch (e: any) {
        if (reloadOnceIfStaleClientServerAction(e)) return;
        toast.error(e?.message || "Erro ao solicitar palavra.");
      }
    });
  };

  const handleVotoMinerva = async () => {
    if (!sessao?.id || !votacaoAtiva?.id) return;
    await withBusy("votoMinerva", async () => {
      try {
        const res = await aplicarVotoMinerva(votacaoAtiva.id, sessao.id, "SIM", mesaToken ?? undefined);
        toast.success(`Voto minerva aplicado. Resultado: ${res.resultado}.`);
      } catch (e: any) {
        if (reloadOnceIfStaleClientServerAction(e)) return;
        toast.error(e?.message || "Não foi possível aplicar o voto minerva.");
        throw e;
      }
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useOratoriaLastMinuteAlert({
    enabled: Boolean(oradorAtual && !semLimiteTempo),
    tempoSec: tempo,
    isRunning,
    semLimiteTempo,
    speakerSolicitacaoId: oratoriaTimer?.speakerSolicitacaoId ?? null,
  });

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-x-hidden">
      {mesaToken ? (
        <div className="shrink-0 rounded-xl border border-blue-500/35 bg-blue-600/10 px-4 py-3 flex items-start gap-3">
          <Info className="shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" size={22} aria-hidden />
          <div className="min-w-0 text-left space-y-1">
            <p className="text-sm font-black uppercase tracking-tight text-foreground">Modo mesa (sem login neste equipamento)</p>
            <p className="text-xs sm:text-sm font-medium leading-snug text-muted-foreground">
              «Ordem do dia» coloca a próxima matéria em discussão (foco). «Iniciar votação» abre o placar quando a presidência decidir. «Voto minerva» só em caso de empate. O operador pode continuar a gerir a fila de palavra no painel próprio.
            </p>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 grid grid-cols-1 xl:grid-cols-12 xl:items-stretch gap-3">
        {/* Esquerda: matéria em foco — mais largura para leitura confortável */}
        <div className="order-1 min-h-0 min-w-0 flex flex-col xl:col-span-7 xl:max-h-full">
          <div className="premium-panel border border-border shadow-lg p-4 sm:p-5 md:p-7 flex flex-col flex-1 min-h-0 min-w-0 gap-3 sm:gap-4 overflow-hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between shrink-0 min-w-0">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                  Presidência da sessão
                </span>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight break-words">
                  Matéria em foco
                </h2>
              </div>
              <span
                className={cn(
                  "self-start shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                  votacaoAtiva
                    ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {votacaoAtiva ? "Votação aberta" : "Sem votação aberta"}
              </span>
            </div>

            <div
              className={cn(
                "premium-panel border border-border bg-muted/30 dark:bg-white/5 flex-1 min-h-0 flex flex-col overflow-hidden",
                votacaoComPdf ? "p-2 sm:p-3" : "p-5 md:p-6",
              )}
            >
              {proposicaoEmDiscussao ? (
                <div
                  className={cn(
                    "flex min-h-0 flex-1 flex-col",
                    votacaoComPdf ? "gap-0 overflow-hidden" : "gap-3 overflow-y-auto custom-scrollbar pr-1",
                  )}
                >
                  {!votacaoComPdf ? (
                  <>
                  <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                    {votacaoAtiva ? "Em votação" : "Em discussão"}
                  </span>
                  <h3 className="shrink-0 break-words text-lg font-black uppercase leading-tight tracking-tight text-foreground sm:text-xl">
                    {rotuloProposicaoEmFoco(proposicaoEmDiscussao)}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Autor:</span>
                    <span className="text-sm md:text-base font-black uppercase tracking-tight text-foreground">
                      {rotuloAutoriaProposicao(proposicaoEmDiscussao)}
                    </span>
                  </div>
                  <p className="shrink-0 break-words text-sm font-semibold leading-snug text-foreground/90 sm:text-base">
                    {proposicaoEmDiscussao.ementa}
                  </p>
                  </>
                  ) : null}
                  <div className={cn("flex min-h-0 flex-1 flex-col", !votacaoComPdf && "min-h-[200px]")}>
                    <PainelVereadorMateriaConteudo
                      proposicao={proposicaoEmDiscussao}
                      modo={votacaoAtiva ? "votacao" : "discussao"}
                      className={votacaoComPdf ? "flex-1 min-h-0" : undefined}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground py-10">
                  <FileText size={48} className="opacity-40 mb-3" />
                  <p className="text-sm font-black uppercase tracking-wider">Aguardando item da pauta</p>
                </div>
              )}
            </div>

            {votacaoAtiva && vereadorId ? (
              <div className="shrink-0 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-600/10 p-3 md:p-4 dark:bg-emerald-950/20">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                  Seu voto como vereador
                </p>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 min-w-0">
                  {(
                    [
                      {
                        id: "SIM" as const,
                        label: "Sim",
                        labelRegistrado: "A favor",
                        icon: CheckCircle2,
                        color:
                          "bg-emerald-600/10 border-emerald-500/25 hover:bg-emerald-600 text-emerald-800 dark:text-emerald-100 hover:text-white",
                        iconColor: "text-emerald-600 dark:text-emerald-400",
                        selected:
                          "bg-emerald-600 border-emerald-400 text-white shadow-md ring-2 ring-emerald-300/50 ring-offset-2 ring-offset-background",
                      },
                      {
                        id: "NAO" as const,
                        label: "Não",
                        labelRegistrado: "Contra",
                        icon: XCircle,
                        color:
                          "bg-red-600/10 border-red-500/25 hover:bg-red-600 text-red-800 dark:text-red-100 hover:text-white",
                        iconColor: "text-red-600 dark:text-red-400",
                        selected:
                          "bg-red-600 border-red-400 text-white shadow-md ring-2 ring-red-300/50 ring-offset-2 ring-offset-background",
                      },
                      {
                        id: "ABSTENCAO" as const,
                        label: "Abstenção",
                        labelRegistrado: "Abstenção",
                        icon: AlertCircle,
                        color:
                          "bg-amber-600/10 border-amber-500/25 hover:bg-amber-600 text-amber-950 dark:text-amber-100 hover:text-white",
                        iconColor: "text-amber-600 dark:text-amber-400",
                        selected:
                          "bg-amber-600 border-amber-400 text-white shadow-md ring-2 ring-amber-300/50 ring-offset-2 ring-offset-background",
                      },
                    ] as const
                  ).map((btn) => {
                    const isMeuVoto = meuVotoAtual === btn.id;
                    const showSpinner = voteSubmitting && voteChoicePending === btn.id;
                    const bloqueadoNoEnvio = voteSubmitting && voteChoicePending !== btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => !voteSubmitting && setVotoParaConfirmar(btn.id)}
                        disabled={voteSubmitting}
                        aria-pressed={isMeuVoto}
                        className={cn(
                          "flex min-h-[72px] sm:min-h-[88px] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center font-black uppercase tracking-tight transition-all active:scale-[0.98]",
                          bloqueadoNoEnvio
                            ? "pointer-events-none cursor-not-allowed border-border bg-muted opacity-60 grayscale"
                            : isMeuVoto
                              ? btn.selected
                              : btn.color
                        )}
                      >
                        {showSpinner ? (
                          <Loader2 size={ICON_VOTO_PREZ} className="animate-spin text-foreground" aria-hidden />
                        ) : (
                          <btn.icon
                            size={ICON_VOTO_PREZ}
                            className={cn(
                              "shrink-0",
                              bloqueadoNoEnvio && "text-muted-foreground",
                              !bloqueadoNoEnvio && (isMeuVoto ? "text-white" : btn.iconColor)
                            )}
                            aria-hidden
                          />
                        )}
                        <span className="text-[10px] leading-tight md:text-[11px]">
                          {isMeuVoto ? (
                            <>
                              <span className="block text-[8px] font-black uppercase opacity-90">Registrado</span>
                              <span>{btn.labelRegistrado}</span>
                            </>
                          ) : (
                            btn.label
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0 min-w-0">
              <button
                type="button"
                onClick={() => setMinervaModalOpen(true)}
                disabled={!empate || presidenteAcaoEmCurso}
                className="min-h-[64px] sm:min-h-[76px] md:min-h-[84px] flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-600/10 hover:bg-amber-600 text-amber-800 dark:text-amber-200 hover:text-white transition-all font-black text-xs md:text-sm uppercase tracking-wider active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:bg-amber-600/10 disabled:hover:text-amber-800 dark:disabled:hover:text-amber-200"
                title={empate ? "Aplicar minerva favorável para desempatar e encerrar" : "Disponível apenas com empate em votação aberta"}
              >
                {isPending("votoMinerva") ? <Loader2 size={18} className="animate-spin shrink-0" aria-hidden /> : <Gavel size={18} className="shrink-0" />}
                {isPending("votoMinerva") ? "A processar…" : "Voto minerva"}
              </button>
              <button
                type="button"
                onClick={handleOrdemDoDia}
                disabled={presidenteAcaoEmCurso}
                className="min-h-[64px] sm:min-h-[76px] md:min-h-[84px] flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-600/10 hover:bg-blue-600 text-blue-800 dark:text-blue-200 hover:text-white transition-all font-black text-xs md:text-sm uppercase tracking-wider active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                title="Passa a próxima matéria da pauta para discussão (sem abrir votação)"
              >
                {isPending("ordemDoDia") ? <Loader2 size={18} className="animate-spin shrink-0" aria-hidden /> : <ListOrdered size={18} className="shrink-0" />}
                {isPending("ordemDoDia") ? "A processar…" : "Ordem do dia"}
              </button>
            </div>

            {!votacaoAtiva ? (
            <button
              type="button"
              onClick={handleIniciarVotacao}
              disabled={!podeIniciarVotacao || presidenteAcaoEmCurso}
              title={
                !proposicaoIdParaAbrirVotacao
                  ? "Avance a ordem do dia para colocar uma matéria em discussão"
                  : "Abre o placar para a matéria em discussão"
              }
              className="min-h-[56px] md:min-h-[60px] flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-900 dark:text-emerald-100 hover:text-white transition-all font-black text-xs md:text-sm uppercase tracking-wider active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:bg-emerald-600/10 disabled:hover:text-emerald-900 dark:disabled:hover:text-emerald-100"
            >
              {isPending("iniciarVotacao") ? <Loader2 size={18} className="animate-spin shrink-0" aria-hidden /> : <Vote size={18} className="shrink-0" />}
              {isPending("iniciarVotacao") ? "A abrir…" : "Iniciar votação"}
            </button>
            ) : null}

            {vereadorId ? (
              <div className="shrink-0 space-y-2 rounded-xl border border-border bg-muted/25 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Pedidos à mesa (como vereador)
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleSolicitarPalavra("DISCURSO")}
                    disabled={qualquerPalavraBusy || voteSubmitting}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-2 py-2 text-[10px] font-black uppercase tracking-tight text-blue-900 transition-colors hover:bg-blue-600 hover:text-white disabled:opacity-50 sm:flex-col sm:py-2.5"
                  >
                    {palavraBusy("DISCURSO") ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Mic2 size={18} className="shrink-0" />}
                    {palavraBusy("DISCURSO") ? "A enviar…" : "Palavra"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSolicitarPalavra("APARTE")}
                    disabled={qualquerPalavraBusy || voteSubmitting}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-600/10 px-2 py-2 text-[10px] font-black uppercase tracking-tight text-amber-950 transition-colors hover:bg-amber-600 hover:text-white disabled:opacity-50 sm:flex-col sm:py-2.5 dark:text-amber-100"
                  >
                    {palavraBusy("APARTE") ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <HelpCircle size={18} className="shrink-0" />}
                    {palavraBusy("APARTE") ? "A enviar…" : "Aparte"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSolicitarPalavra("QUESTAO_ORDEM")}
                    disabled={qualquerPalavraBusy || voteSubmitting}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-600/10 px-2 py-2 text-[10px] font-black uppercase tracking-tight text-purple-950 transition-colors hover:bg-purple-600 hover:text-white disabled:opacity-50 sm:flex-col sm:py-2.5 dark:text-purple-100"
                  >
                    {palavraBusy("QUESTAO_ORDEM") ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <AlertCircle size={18} className="shrink-0" />}
                    {palavraBusy("QUESTAO_ORDEM") ? "A enviar…" : "Q. ordem"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Direita: abas — pauta (lista), ordem de fala, resultado dos votos */}
        <div className="order-2 min-h-0 min-w-0 flex flex-col xl:col-span-5 xl:max-h-full">
          <div className="premium-panel border border-border shadow-md flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden p-3 md:p-4 max-h-[min(70vh,720px)] xl:max-h-none">
            <div
              role="tablist"
              aria-label="Painéis da presidência"
              className="flex shrink-0 gap-1 rounded-xl border border-border bg-muted/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={abaPresidente === "pauta"}
                onClick={() => setAbaPresidente("pauta")}
                title="Fila da pauta oficial"
                className={cn(
                  "flex-1 min-w-0 rounded-lg px-2 py-2.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-tight transition-colors",
                  abaPresidente === "pauta"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                Pauta
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={abaPresidente === "fala"}
                onClick={() => setAbaPresidente("fala")}
                title="Ordem de fala"
                className={cn(
                  "flex-1 min-w-0 rounded-lg px-2 py-2.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-tight transition-colors",
                  abaPresidente === "fala"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                Fala
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={abaPresidente === "votos"}
                onClick={() => setAbaPresidente("votos")}
                title="Resultado dos votos"
                className={cn(
                  "relative flex-1 min-w-0 rounded-lg px-2 py-2.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-tight transition-colors",
                  abaPresidente === "votos"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                Votos
                {votacaoAtiva ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" aria-hidden />
                ) : null}
              </button>
            </div>

            <div className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
              {abaPresidente === "pauta" ? (
                <div
                  role="tabpanel"
                  aria-label="Fila da pauta"
                  className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border border-blue-500/20 bg-blue-600/5 dark:bg-blue-500/10 p-3"
                >
                  <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-100">
                      Posição: <span className="tabular-nums text-foreground">{rotuloPosicaoPauta}</span>
                    </p>
                    <span className="rounded-full border border-blue-500/30 bg-blue-600/15 px-2 py-0.5 text-[10px] font-black uppercase text-blue-900 dark:text-blue-50">
                      {ordemDoDia.length} itens
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
                    {ordemDoDia.length === 0 ? (
                      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-blue-500/25 p-6 text-center text-muted-foreground">
                        <ListOrdered size={32} className="mb-2 opacity-40" />
                        <p className="text-xs font-black uppercase tracking-wider">Sem matérias na pauta</p>
                      </div>
                    ) : (
                      itensPautaOrdenados.map((item, idx) => {
                        const status = statusDiscussao(item);
                        const isEmVotacao = votacaoAtiva?.proposicao_id === item.proposicao_id;
                        const isEmDiscussao = status === "EM_DISCUSSAO" && !isEmVotacao;
                        const statusLabel = isEmVotacao ? "Em votação" : (statusLabelMap[status] || status || "Aguardando");
                        const seq = Number(item?.ordem_sequencial ?? idx + 1);
                        return (
                          <div
                            key={item.id ?? `pauta-${item.proposicao_id}-${seq}`}
                            className={cn(
                              "rounded-lg border p-2.5 md:p-3 bg-card/90",
                              isEmVotacao
                                ? "border-emerald-500/40 bg-emerald-600/10"
                                : isEmDiscussao
                                  ? "border-blue-500/40 bg-blue-600/10"
                                  : "border-border"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 text-xs md:text-sm font-black uppercase leading-snug text-foreground">
                                {seq}. {item.proposicao?.tipo} {item.proposicao?.numero}/{item.proposicao?.ano}
                              </p>
                              <span
                                className={cn(
                                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase border",
                                  isEmVotacao
                                    ? "border-emerald-500 bg-emerald-600 text-white"
                                    : isEmDiscussao
                                      ? "border-blue-500 bg-blue-600 text-white"
                                      : "border-border bg-muted text-muted-foreground"
                                )}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-4 text-[11px] md:text-xs leading-snug text-muted-foreground">
                              {item.proposicao?.ementa}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {abaPresidente === "fala" ? (
                <div
                  role="tabpanel"
                  aria-label="Ordem de fala"
                  className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="mb-2 flex shrink-0 items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Fila pendente
                    </span>
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400">{filaOratoria.length}</span>
                  </div>
                  <div className="mb-3 shrink-0 rounded-lg border border-purple-500/25 bg-purple-600/10 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-1">
                      Orador atual
                    </p>
                    {oradorAtual ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[11px] font-black uppercase text-foreground">
                          {nomeOradorSolicitacao(oradorAtual)}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 text-[10px] font-black tabular-nums",
                            semLimiteTempo && "normal-case tracking-tight",
                            timerVisualClass
                          )}
                        >
                          {semLimiteTempo ? "Sem limite" : `${oratoriaMin}:${oratoriaSeg}`}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] font-black uppercase text-foreground">Nenhum orador em andamento</p>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
                    {filaOratoria.length === 0 ? (
                      <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground">
                        <Mic2 size={24} className="mb-2 opacity-40" aria-hidden />
                        <p className="text-[10px] font-black uppercase tracking-wider">Fila de fala vazia</p>
                      </div>
                    ) : (
                      filaOratoria.map((sol, idx) => (
                        <div
                          key={sol.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/80 p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black uppercase text-foreground">
                              {idx + 1}. {nomeOradorSolicitacao(sol)}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                              {String(sol.tipo || "DISCURSO").replaceAll("_", " ")}
                            </p>
                          </div>
                          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] font-black uppercase text-muted-foreground">
                            Pendente
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {abaPresidente === "votos" ? (
                <div
                  role="tabpanel"
                  aria-label="Resultado dos votos"
                  className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border border-border p-3"
                >
                  {votacaoAtiva ? (
                    <>
                      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-foreground">
                          <Vote size={16} className="text-emerald-600 dark:text-emerald-400" />
                          Votação em curso
                        </h3>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-600/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:text-emerald-200">
                          Ativa
                        </span>
                      </div>
                      <div className="mb-3 grid shrink-0 grid-cols-3 gap-2">
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-600/12 p-2.5 text-center">
                          <p className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">Sim</p>
                          <p className="text-2xl font-black tabular-nums text-foreground">{totalSim}</p>
                        </div>
                        <div className="rounded-lg border border-red-500/30 bg-red-600/12 p-2.5 text-center">
                          <p className="text-[9px] font-black uppercase text-red-700 dark:text-red-300">Não</p>
                          <p className="text-2xl font-black tabular-nums text-foreground">{totalNao}</p>
                        </div>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-600/12 p-2.5 text-center">
                          <p className="text-[9px] font-black uppercase text-amber-800 dark:text-amber-200">Abs</p>
                          <p className="text-2xl font-black tabular-nums text-foreground">{totalAbs}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
                        {vereadores.map((v) => {
                          const voto = getVotoVereador(v.id);
                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div
                                  className={cn(
                                    "h-2 w-2 shrink-0 rounded-full",
                                    voto ? "bg-emerald-500" : "bg-muted-foreground/40"
                                  )}
                                />
                                <span className="truncate text-[11px] font-black uppercase text-foreground">
                                  {v.nome_parlamentar || v.nome}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase",
                                  voto === "SIM"
                                    ? "border-emerald-500 bg-emerald-600 text-white"
                                    : voto === "NAO"
                                      ? "border-red-500 bg-red-600 text-white"
                                      : voto === "ABSTENCAO"
                                        ? "border-amber-500 bg-amber-600 text-white"
                                        : "border-border bg-background text-muted-foreground"
                                )}
                              >
                                {voto || "Pendente"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground">
                      <Vote size={36} className="opacity-35" aria-hidden />
                      <p className="text-sm font-black uppercase tracking-tight text-foreground">Sem votação aberta</p>
                      <p className="max-w-[16rem] text-xs font-medium leading-relaxed">
                        Quando a votação for iniciada (presidência ou operador), o placar e o estado de cada vereador aparecem nesta aba.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <BlockingModal
        isOpen={semOrdemModal.open}
        onClose={() => setSemOrdemModal({ open: false, message: "" })}
        mode="alert"
        title="Não há ordem a ser votada"
        message={semOrdemModal.message}
      />

      <BlockingModal
        isOpen={minervaModalOpen}
        onClose={() => setMinervaModalOpen(false)}
        mode="confirm"
        title="Aplicar voto minerva?"
        message="Em caso de empate, o voto de qualidade da presidência será aplicado como SIM e a votação será encerrada."
        confirmLabel="Aplicar minerva"
        cancelLabel="Cancelar"
        onConfirm={handleVotoMinerva}
      />

      <BlockingModal
        isOpen={votoParaConfirmar !== null}
        onClose={() => setVotoParaConfirmar(null)}
        mode="confirm"
        title="Confirmar seu voto"
        message={
          votoParaConfirmar
            ? `Você está registrando o voto ${rotuloCompletoOpcao(votoParaConfirmar)} nesta matéria.\n\nConfirme somente se for essa a sua decisão no momento — o registro é oficial no sistema.\n\nSe não for isso, toque em Voltar.`
            : ""
        }
        confirmLabel="Confirmar voto"
        cancelLabel="Voltar"
        onConfirm={async () => {
          const escolha = votoParaConfirmar;
          if (!escolha || !votacaoAtiva || !vereadorId) return;
          await executarRegistroVoto(escolha);
        }}
      />
    </div>
  );
}
