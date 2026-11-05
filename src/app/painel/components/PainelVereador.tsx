'use client';

import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle, Mic2, HelpCircle, FileText, Info, Loader2, MapPin, Monitor, Shield, Gavel } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { registrarVoto, solicitarPalavra, registrarPresenca } from "../actions";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { rotuloAutoriaProposicao } from "@/lib/proposicao-autoria";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { compareSolicitacaoCreatedDesc, pickOradorEmFala, isOradorPresidenteMesa } from "@/lib/painel/orador-display";
import { reloadOnceIfStaleClientServerAction } from "@/lib/next-stale-server-action";
import { useOratoriaLastMinuteAlert } from "@/hooks/use-oratoria-last-minute-alert";
import { computeTempoRestanteOratoriaSec } from "@/lib/painel/oratoria-tempo-restante";
import { PainelVereadorMateriaConteudo } from "./PainelVereadorMateria";

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

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function PainelVereador({ 
  sessao, 
  ordemDoDia = [],
  votacaoAtiva, 
  votos,
  solicitacoes = [],
  oratoriaTimer,
  oratoriaClockSkewMs = 0,
  userProfile,
  mergeOptimisticVoto,
  reconcilePainel,
}: { 
  sessao: any; 
  ordemDoDia?: any[];
  votacaoAtiva: any; 
  votos: any[];
  solicitacoes?: any[];
  oratoriaTimer?: any;
  oratoriaClockSkewMs?: number;
  userProfile?: any;
  mergeOptimisticVoto?: (votacaoId: string, vereadorId: string, voto: "SIM" | "NAO" | "ABSTENCAO") => void;
  reconcilePainel?: () => Promise<void>;
}) {
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
  const checkinBusy = isPending("checkin:PRESENCIAL") || isPending("checkin:REMOTO");
  const palavraKey = (tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM") => `palavra:${tipo}`;
  const palavraBusy = (tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM") => isPending(palavraKey(tipo));
  const qualquerPalavraBusy =
    isPending("palavra:DISCURSO") || isPending("palavra:APARTE") || isPending("palavra:QUESTAO_ORDEM");

  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteChoicePending, setVoteChoicePending] = useState<"SIM" | "NAO" | "ABSTENCAO" | null>(null);
  const [votoParaConfirmar, setVotoParaConfirmar] = useState<"SIM" | "NAO" | "ABSTENCAO" | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const vereadorId = userProfile?.vereador_id || userProfile?.vereador?.id || null;
  /** Só ADMIN_MASTER pode mandar ID explícito (simulação); vereador real usa o vínculo da sessão no servidor. */
  const votoVereadorOverride =
    userProfile?.role === "ADMIN_MASTER" && vereadorId ? vereadorId : undefined;
  const palavraVereadorOverride =
    userProfile?.role === "ADMIN_MASTER" && vereadorId ? vereadorId : undefined;

  const mostrarVoltaPresidencia =
    String(userProfile?.vereador?.cargo_mesa ?? "").toUpperCase() === "PRESIDENTE" ||
    String(userProfile?.role ?? "").toUpperCase() === "PRESIDENTE";

  const linkVoltaPresidencia = mostrarVoltaPresidencia ? (
    <div className="flex w-full shrink-0 justify-end px-1 pb-2">
      <Link
        href="/painel/presidente"
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-600/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-amber-950 transition-colors hover:bg-amber-600 hover:text-white dark:text-amber-50"
      >
        <Gavel className="h-4 w-4 shrink-0" aria-hidden />
        Voltar ao painel da presidência
      </Link>
    </div>
  ) : null;

  // Busca presença do vereador atual
  const presenca = sessao?.presencas?.find((p: any) => p.vereador_id === vereadorId);
  const isPresente = !!presenca && presenca.status !== 'AUSENTE';
  const oradorAtual = pickOradorEmFala(solicitacoes);
  const isEuOradorAtual = !!oradorAtual && !!vereadorId && oradorAtual.vereador_id === vereadorId;
  const semLimiteTempo =
    Boolean(oratoriaTimer?.semLimiteTempo) ||
    (!!oradorAtual && isOradorPresidenteMesa(oradorAtual));
  const minhasSolicitacoesOrdenadas = [...solicitacoes]
    .filter((s) => s.vereador_id === vereadorId)
    .sort(compareSolicitacaoCreatedDesc);
  const meuUltimoPendente = minhasSolicitacoesOrdenadas.find(
    (s) => String(s.status ?? "").toUpperCase() === "PENDENTE"
  );
  const pausedEntries: Array<{ solicitacaoId: string; remainingSec: number }> = Array.isArray(oratoriaTimer?.pausedEntries)
    ? oratoriaTimer.pausedEntries
    : [];
  const meuTempoPausado = meuUltimoPendente
    ? pausedEntries.find((e) => e.solicitacaoId === meuUltimoPendente.id)
    : null;
  const isRunning = Boolean(oratoriaTimer?.isRunning);
  const tempo = semLimiteTempo
    ? 0
    : computeTempoRestanteOratoriaSec(oratoriaTimer, agora, oratoriaClockSkewMs ?? 0);
  const oratoriaMin = String(Math.floor(tempo / 60)).padStart(2, "0");
  const oratoriaSeg = String(tempo % 60).padStart(2, "0");
  const tempoFinalizando = !semLimiteTempo && tempo <= 60;
  const tempoParado = !semLimiteTempo && !isRunning && tempo > 0;
  const timerVisualClass = semLimiteTempo
    ? "bg-slate-700 text-white border border-slate-500/40 shadow-slate-600/20"
    : tempoFinalizando
      ? "bg-red-600 text-white border border-red-500 shadow-red-600/30"
      : tempoParado
        ? "bg-amber-500 text-white border border-amber-400 shadow-amber-500/30"
        : "bg-emerald-600 text-white border border-emerald-500 shadow-emerald-600/30";

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useOratoriaLastMinuteAlert({
    enabled: isEuOradorAtual && !semLimiteTempo,
    tempoSec: tempo,
    isRunning,
    semLimiteTempo,
    speakerSolicitacaoId: oratoriaTimer?.speakerSolicitacaoId ?? null,
  });

  const handleCheckIn = async (tipo: 'PRESENCIAL' | 'REMOTO') => {
    if (!sessao || !vereadorId) {
      toast.error("Vereador não identificado para registrar presença.");
      return;
    }
    await withBusy(`checkin:${tipo}`, async () => {
      try {
        await registrarPresenca(sessao.id, 'PRESENTE', vereadorId);
        toast.success("Presença registrada com sucesso!");
      } catch (e: any) {
        console.error("Erro no check-in:", e);
        if (reloadOnceIfStaleClientServerAction(e)) return;
        toast.error(e.message || "Erro ao registrar presença.");
      }
    });
  };

  /** Chamado só depois da confirmação no modal. */
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

  const handleSolicitarPalavra = async (tipo: 'DISCURSO' | 'APARTE' | 'QUESTAO_ORDEM') => {
    if (!sessao?.id) {
      toast.error("Nenhuma sessão ativa para registrar o pedido.");
      return;
    }
    if (!vereadorId) {
      toast.error("Conta sem vínculo de vereador. Solicite ao administrador.");
      return;
    }
    const key = palavraKey(tipo);
    await withBusy(key, async () => {
      try {
        await solicitarPalavra(sessao.id, tipo, palavraVereadorOverride);
        if (tipo === "DISCURSO") {
          toast.success("Você entrou na fila da pauta. Aguarde a mesa chamar.");
        } else if (tipo === "APARTE") {
          toast.success("Pedido de aparte enviado à mesa (durante a fala de outro parlamentar).");
        } else {
          toast.success("Questão de ordem registrada na mesa.");
        }
      } catch (e: any) {
        if (reloadOnceIfStaleClientServerAction(e)) return;
        toast.error(e.message || "Erro ao solicitar palavra.");
      }
    });
  };

  // TELA DE CHECK-IN
  if (!isPresente) {
    return (
      <div className="flex flex-1 min-h-0 min-w-0 flex-col items-center justify-center overflow-y-auto overflow-x-hidden text-center px-4 sm:px-6 gap-6 sm:gap-10 py-4 w-full">
        {linkVoltaPresidencia}
        <div className="p-6 sm:p-10 md:p-12 premium-panel rounded-xl border border-border space-y-6 sm:space-y-8 w-full max-w-xl shadow-2xl">
          <div className="p-6 bg-blue-600 rounded-xl w-fit mx-auto shadow-xl shadow-blue-600/20">
            <Shield size={64} className="text-white" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground uppercase tracking-tighter leading-tight break-words">
              Check-in de Presença
            </h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
              Seja bem-vindo, {userProfile?.nome_completo?.split(' ')[0] || 'Vereador'}. <br/>
              Como você participará da sessão hoje?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full max-w-5xl min-w-0">
          <button 
            onClick={() => handleCheckIn('PRESENCIAL')}
            disabled={checkinBusy}
            className="flex flex-col items-center justify-center gap-4 sm:gap-8 p-8 sm:p-12 md:p-16 w-full min-w-0 bg-emerald-600/5 hover:bg-emerald-600 border-2 border-emerald-500/20 hover:border-emerald-400 rounded-xl transition-all group active:scale-95 disabled:opacity-50 shadow-xl"
          >
            {isPending("checkin:PRESENCIAL") ? <Loader2 className="animate-spin text-emerald-600 group-hover:text-white" size={64} aria-hidden /> : <MapPin size={80} className="text-emerald-500 group-hover:text-white transition-all" />}
            <div className="text-center">
              <span className="block text-2xl sm:text-3xl font-black text-foreground group-hover:text-white uppercase tracking-tighter break-words">
                {isPending("checkin:PRESENCIAL") ? "A registar…" : "No Plenário"}
              </span>
              <span className="text-emerald-600/60 dark:text-emerald-400/60 group-hover:text-white/60 text-[10px] font-black uppercase tracking-[0.3em] block mt-2">Check-in Presencial</span>
            </div>
          </button>

          <button 
            onClick={() => handleCheckIn('REMOTO')}
            disabled={checkinBusy}
            className="flex flex-col items-center justify-center gap-4 sm:gap-8 p-8 sm:p-12 md:p-16 w-full min-w-0 bg-blue-600/5 hover:bg-blue-600 border-2 border-blue-500/20 hover:border-blue-400 rounded-xl transition-all group active:scale-95 disabled:opacity-50 shadow-xl"
          >
            {isPending("checkin:REMOTO") ? <Loader2 className="animate-spin text-blue-600 group-hover:text-white" size={64} aria-hidden /> : <Monitor size={80} className="text-blue-500 group-hover:text-white transition-all" />}
            <div className="text-center min-w-0">
              <span className="block text-2xl sm:text-3xl font-black text-foreground group-hover:text-white uppercase tracking-tighter break-words">
                {isPending("checkin:REMOTO") ? "A registar…" : "Via Sistema"}
              </span>
              <span className="text-blue-600/60 dark:text-blue-400/60 group-hover:text-white/60 text-[10px] font-black uppercase tracking-[0.3em] block mt-2">Acesso Remoto</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // TELA DE AGUARDANDO VOTAÇÃO
  if (!votacaoAtiva) {
    const itemEmDiscussao = Array.isArray(ordemDoDia)
      ? ordemDoDia.find((item: any) => String(item?.status_discussao || "").toUpperCase() === "EM_DISCUSSAO")
      : null;
    const proposicaoEmDiscussao = itemEmDiscussao?.proposicao;

    return (
      <div className="flex flex-col flex-1 min-h-0 min-w-0 h-full gap-4 sm:gap-6 max-w-6xl mx-auto w-full px-3 sm:px-6 py-2 overflow-y-auto overflow-x-hidden overscroll-contain">
        {linkVoltaPresidencia}
        {!isEuOradorAtual && meuTempoPausado && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Sua fala está pausada
              </p>
              <p className="text-sm font-black text-foreground uppercase tracking-tight">
                Você retorna após o aparte/questão em andamento
              </p>
            </div>
            <span className="rounded-lg bg-amber-500 text-white px-3 py-2 text-2xl font-mono font-black tabular-nums">
              {formatSeconds(meuTempoPausado.remainingSec)}
            </span>
          </div>
        )}
        {isEuOradorAtual && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-600/10 p-4 flex items-center justify-between gap-3 min-w-0 shrink-0">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Você está na oratória
              </p>
              <p className="text-sm font-black text-foreground uppercase tracking-tight">
                {semLimiteTempo ? "Presidente da mesa — sem limite de tempo" : "Tempo em andamento"}
              </p>
            </div>
            <span className={cn(
              "rounded-lg px-3 py-2 text-2xl font-mono font-black tabular-nums shadow-sm",
              semLimiteTempo && "font-black text-lg md:text-xl normal-case min-w-[8rem] text-center",
              timerVisualClass
            )}>
              {semLimiteTempo ? "Sem limite" : `${oratoriaMin}:${oratoriaSeg}`}
            </span>
          </div>
        )}
        {!proposicaoEmDiscussao && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="p-16 premium-panel rounded-xl border border-border space-y-8 max-w-2xl shadow-2xl">
              <div className="p-6 bg-blue-600/10 rounded-full w-fit mx-auto border border-blue-500/20 shadow-inner">
                <Info size={64} className="text-blue-600" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-foreground uppercase tracking-tighter leading-tight">
                  Sessão em Andamento
                </h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] leading-relaxed max-w-md mx-auto">
                  Aguardando proposição para votação. Use os controles abaixo para interagir com a mesa diretora.
                </p>
              </div>
            </div>
          </div>
        )}

        {proposicaoEmDiscussao && (
          <div className="premium-panel rounded-xl border border-border p-4 md:p-5 shadow-lg">
            <div className="flex flex-col gap-1">
              <span className="text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.2em] text-[9px]">
                Matéria em discussão
              </span>
              <h3 className="text-lg md:text-xl font-black text-foreground uppercase tracking-tight">
                {proposicaoEmDiscussao.tipo}{" "}
                {proposicaoEmDiscussao.numero != null
                  ? `${proposicaoEmDiscussao.numero}/${proposicaoEmDiscussao.ano}`
                  : proposicaoEmDiscussao.ano ?? ""}
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Autoria: {rotuloAutoriaProposicao(proposicaoEmDiscussao)}
              </p>
            </div>
            <div className="mt-2 flex min-h-0 max-h-[min(50vh,420px)] flex-col">
              <PainelVereadorMateriaConteudo proposicao={proposicaoEmDiscussao} modo="discussao" />
            </div>
          </div>
        )}

        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 min-w-0">
          <button
            type="button"
            onClick={() => handleSolicitarPalavra("DISCURSO")}
            disabled={qualquerPalavraBusy}
            className="min-h-[86px] w-full flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl bg-blue-600/10 hover:bg-blue-600 border border-blue-500/25 text-blue-700 dark:text-blue-300 hover:text-white transition-all font-black text-sm uppercase tracking-wider disabled:opacity-50 active:scale-[0.99] shadow-lg"
          >
            {palavraBusy("DISCURSO") ? <Loader2 className="animate-spin h-6 w-6 shrink-0" aria-hidden /> : <Mic2 size={22} />}
            {palavraBusy("DISCURSO") ? "A enviar…" : "Pedir palavra"}
          </button>

          <button
            type="button"
            onClick={() => handleSolicitarPalavra("APARTE")}
            disabled={qualquerPalavraBusy}
            className="min-h-[86px] w-full flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl bg-amber-600/10 hover:bg-amber-600 border border-amber-500/25 text-amber-800 dark:text-amber-200 hover:text-white transition-all font-black text-sm uppercase tracking-wider disabled:opacity-50 active:scale-[0.99] shadow-lg"
          >
            {palavraBusy("APARTE") ? <Loader2 className="animate-spin h-6 w-6 shrink-0" aria-hidden /> : <HelpCircle size={22} />}
            {palavraBusy("APARTE") ? "A enviar…" : "Pedir aparte"}
          </button>

          <button
            type="button"
            onClick={() => handleSolicitarPalavra("QUESTAO_ORDEM")}
            disabled={qualquerPalavraBusy}
            className="min-h-[86px] w-full flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl bg-purple-600/10 hover:bg-purple-600 border border-purple-500/25 text-purple-800 dark:text-purple-200 hover:text-white transition-all font-black text-sm uppercase tracking-wider disabled:opacity-50 active:scale-[0.99] shadow-lg"
          >
            {palavraBusy("QUESTAO_ORDEM") ? <Loader2 className="animate-spin h-6 w-6 shrink-0" aria-hidden /> : <AlertCircle size={22} />}
            {palavraBusy("QUESTAO_ORDEM") ? "A enviar…" : "Questão de ordem"}
          </button>

          <button
            type="button"
            disabled
            className="min-h-[86px] w-full flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl bg-red-600/5 border border-red-500/15 text-red-600/50 cursor-not-allowed font-black text-sm uppercase tracking-wider shadow-lg"
          >
            <Info size={22} />
            Pedir vistas — em breve
          </button>

          <button
            type="button"
            disabled
            className="md:col-span-2 min-h-[86px] w-full flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl bg-teal-600/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 cursor-not-allowed font-black text-sm uppercase tracking-wider opacity-80 shadow-lg"
          >
            <FileText size={22} />
            Regimento interno — em breve
          </button>
        </div>
      </div>
    );
  }

  const meuVotoAtual =
    vereadorId && votacaoAtiva
      ? (votos.find((v: { vereador_id?: string }) => v.vereador_id === vereadorId)?.voto as
          | "SIM"
          | "NAO"
          | "ABSTENCAO"
          | undefined)
      : undefined;

  const proposicaoEmVotacao = votacaoAtiva?.proposicao as
    | {
        tipo?: string;
        numero?: number | null;
        ano?: number;
        ementa?: string;
        texto_completo?: string;
        pdf_url?: string | null;
        autor?: { nome_parlamentar?: string | null };
      }
    | undefined;
  const ICON_VOTO = 52;
  const votacaoComPdf = Boolean(proposicaoEmVotacao?.pdf_url?.trim());

  // TELA DE VOTAÇÃO ATIVA — leitura usa o espaço vertical livre; rolagem só dentro da caixa da ementa
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 h-full max-w-6xl mx-auto w-full px-3 sm:px-4 py-1 gap-2 overflow-hidden">
      {linkVoltaPresidencia}
      {!isEuOradorAtual && meuTempoPausado && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3 shrink-0 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Sua fala está pausada
            </p>
            <p className="text-xs font-black text-foreground uppercase tracking-tight">
              Aguarde a retomada pela mesa
            </p>
          </div>
          <span className="rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xl font-mono font-black tabular-nums">
            {formatSeconds(meuTempoPausado.remainingSec)}
          </span>
        </div>
      )}
      {isEuOradorAtual && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-600/10 p-3 flex items-center justify-between gap-3 shrink-0 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Você está na oratória
            </p>
            <p className="text-xs font-black text-foreground uppercase tracking-tight break-words">
              {semLimiteTempo ? "Presidente da mesa — sem limite" : "Tempo oficial em andamento"}
            </p>
          </div>
          <span className={cn(
            "rounded-lg px-3 py-1.5 text-xl font-mono font-black tabular-nums shadow-sm",
            semLimiteTempo && "font-black text-sm normal-case min-w-[6.5rem] text-center",
            timerVisualClass
          )}>
            {semLimiteTempo ? "Sem limite" : `${oratoriaMin}:${oratoriaSeg}`}
          </span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 shrink-0 min-w-0 lg:hidden">
        <button
          type="button"
          onClick={() => handleSolicitarPalavra("DISCURSO")}
          disabled={qualquerPalavraBusy || voteSubmitting}
          title="Palavra na pauta"
          className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-blue-500/35 bg-blue-600/10 px-1 py-2 text-blue-900 transition-colors hover:bg-blue-600 hover:text-white disabled:opacity-50 dark:text-blue-100"
        >
          {palavraBusy("DISCURSO") ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Mic2 className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="w-full truncate text-center text-[8px] font-black uppercase leading-tight">{palavraBusy("DISCURSO") ? "…" : "Palavra"}</span>
        </button>
        <button
          type="button"
          onClick={() => handleSolicitarPalavra("APARTE")}
          disabled={qualquerPalavraBusy || voteSubmitting}
          title="Aparte"
          className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-500/35 bg-amber-600/10 px-1 py-2 text-amber-950 transition-colors hover:bg-amber-600 hover:text-white disabled:opacity-50 dark:text-amber-100"
        >
          {palavraBusy("APARTE") ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="w-full truncate text-center text-[8px] font-black uppercase leading-tight">{palavraBusy("APARTE") ? "…" : "Aparte"}</span>
        </button>
        <button
          type="button"
          onClick={() => handleSolicitarPalavra("QUESTAO_ORDEM")}
          disabled={qualquerPalavraBusy || voteSubmitting}
          title="Questão de ordem"
          className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-purple-500/35 bg-purple-600/10 px-1 py-2 text-purple-950 transition-colors hover:bg-purple-600 hover:text-white disabled:opacity-50 dark:text-purple-100"
        >
          {palavraBusy("QUESTAO_ORDEM") ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="w-full truncate text-center text-[8px] font-black uppercase leading-tight">{palavraBusy("QUESTAO_ORDEM") ? "…" : "Q. ordem"}</span>
        </button>
        <button
          type="button"
          disabled
          title="Regimento interno (em breve)"
          className="flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-teal-500/35 bg-teal-600/10 px-1 py-2 text-teal-900 opacity-80 dark:text-teal-100 cursor-not-allowed"
        >
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
          <span className="w-full truncate text-center text-[8px] font-black uppercase leading-tight">Regimento</span>
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:overflow-hidden">
        <div
          className={cn(
            "premium-panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border shadow-lg lg:min-h-[12rem]",
            votacaoComPdf ? "p-2 sm:p-3" : "p-3 sm:p-4 md:p-5",
          )}
        >
          {!votacaoComPdf ? (
          <>
          <div className="pointer-events-none absolute top-2 right-2 hidden opacity-[0.06] sm:block">
            <FileText size={72} />
          </div>
          <div className="relative z-10 shrink-0 space-y-1 border-b border-border/60 pb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Votação em curso</span>
            {proposicaoEmVotacao ? (
              <>
                <h2 className="text-sm font-black uppercase leading-snug tracking-tight text-foreground sm:text-base md:text-lg">
                  {proposicaoEmVotacao.tipo}
                  {proposicaoEmVotacao.numero != null ? ` ${proposicaoEmVotacao.numero}/${proposicaoEmVotacao.ano}` : proposicaoEmVotacao.ano != null ? ` ${proposicaoEmVotacao.ano}` : ""}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{rotuloAutoriaProposicao(proposicaoEmVotacao)}</p>
              </>
            ) : (
              <p className="text-[10px] font-bold uppercase italic tracking-wider text-slate-500 opacity-80">Consulte o telão para a matéria completa.</p>
            )}
          </div>
          </>
          ) : null}

          <PainelVereadorMateriaConteudo
            proposicao={proposicaoEmVotacao}
            modo="votacao"
            className="flex-1 min-h-0"
          />
        </div>

        <aside className="hidden min-w-0 flex-col gap-2 rounded-xl border border-border p-3 premium-panel lg:flex lg:overflow-y-auto lg:custom-scrollbar lg:self-stretch">
          <button
            type="button"
            onClick={() => handleSolicitarPalavra("DISCURSO")}
            disabled={qualquerPalavraBusy || voteSubmitting}
            className="min-h-[88px] lg:min-h-[100px] w-full min-w-0 flex flex-col items-start justify-center gap-1.5 p-3.5 rounded-xl border border-blue-500/35 bg-blue-600/10 hover:bg-blue-600 text-blue-900 dark:text-blue-100 hover:text-white transition-all shadow-sm hover:shadow-md font-black text-[11px] uppercase tracking-wider disabled:opacity-50 text-left"
          >
            <span className="flex items-center gap-2">
              {palavraBusy("DISCURSO") ? <Loader2 className="animate-spin h-5 w-5 shrink-0" aria-hidden /> : <Mic2 size={19} />}
              {palavraBusy("DISCURSO") ? "A enviar…" : "Palavra na pauta"}
            </span>
            <span className="text-[10px] font-semibold normal-case text-slate-700 dark:text-slate-300 hover:text-white/90 leading-snug">
              Fila da ordem do dia.
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSolicitarPalavra("APARTE")}
            disabled={qualquerPalavraBusy || voteSubmitting}
            className="min-h-[88px] lg:min-h-[100px] w-full min-w-0 flex flex-col items-start justify-center gap-1.5 p-3.5 rounded-xl border border-amber-500/35 bg-amber-600/10 hover:bg-amber-600 text-amber-950 dark:text-amber-100 hover:text-white transition-all shadow-sm hover:shadow-md font-black text-[11px] uppercase tracking-wider disabled:opacity-50 text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              {palavraBusy("APARTE") ? <Loader2 className="animate-spin h-5 w-5 shrink-0" aria-hidden /> : <HelpCircle size={19} />}
              {palavraBusy("APARTE") ? "A enviar…" : "Aparte"}
            </span>
            <span className="text-[10px] font-semibold normal-case text-slate-700 dark:text-slate-300 hover:text-white/90 leading-snug">
              Durante a fala de outro vereador.
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSolicitarPalavra("QUESTAO_ORDEM")}
            disabled={qualquerPalavraBusy || voteSubmitting}
            className="min-h-[88px] lg:min-h-[100px] w-full min-w-0 p-3.5 rounded-xl border border-purple-500/35 bg-purple-600/10 hover:bg-purple-600 text-[11px] font-black uppercase tracking-wider text-purple-950 dark:text-purple-100 hover:text-white disabled:opacity-50 text-left flex flex-col items-start justify-center gap-1.5 shadow-sm hover:shadow-md"
          >
            <span className="flex items-center gap-2 min-w-0">
              {palavraBusy("QUESTAO_ORDEM") ? <Loader2 className="animate-spin h-5 w-5 shrink-0" aria-hidden /> : <AlertCircle size={19} />}
              {palavraBusy("QUESTAO_ORDEM") ? "A enviar…" : "Questão de ordem"}
            </span>
          </button>
          <button
            type="button"
            disabled
            className="min-h-[88px] lg:min-h-[100px] w-full min-w-0 p-3.5 rounded-xl border border-teal-500/35 bg-teal-600/10 text-[11px] font-black uppercase tracking-wider text-teal-900 dark:text-teal-100 cursor-not-allowed text-left flex items-center gap-2.5 opacity-90 shadow-sm sm:col-span-2 lg:col-span-1"
          >
            <FileText size={19} />
            Regimento interno (em breve)
          </button>
        </aside>
      </div>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 shrink-0 items-stretch min-w-0 pb-1">
          {[
            {
              id: "SIM" as const,
              label: "Votar a Favor",
              /** Texto quando já há voto registrado (evita “Seu voto · Votar a favor”). */
              labelRegistrado: "A favor",
              icon: CheckCircle2,
              color:
                "bg-emerald-600/10 border-emerald-500/20 hover:bg-emerald-600 text-emerald-600 shadow-emerald-600/10",
              iconColor: "text-emerald-500",
              selected:
                "bg-emerald-600 border-emerald-400 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-300/60 ring-offset-2 ring-offset-background",
            },
            {
              id: "NAO" as const,
              label: "Votar Contra",
              labelRegistrado: "Contra",
              icon: XCircle,
              color: "bg-red-600/10 border-red-500/20 hover:bg-red-600 text-red-600 shadow-red-600/10",
              iconColor: "text-red-500",
              selected:
                "bg-red-600 border-red-400 text-white shadow-md shadow-red-600/20 ring-2 ring-red-300/60 ring-offset-2 ring-offset-background",
            },
            {
              id: "ABSTENCAO" as const,
              label: "Abster-se",
              labelRegistrado: "Abstenção",
              icon: AlertCircle,
              color: "bg-amber-600/10 border-amber-600/20 hover:bg-amber-600 text-amber-600 shadow-amber-600/10",
              iconColor: "text-amber-500",
              selected:
                "bg-amber-600 border-amber-400 text-white shadow-md shadow-amber-600/20 ring-2 ring-amber-300/60 ring-offset-2 ring-offset-background",
            },
          ].map((btn) => {
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
                aria-busy={showSpinner}
                className={cn(
                  "h-full w-full flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 py-7 px-3 md:py-7 md:px-4 shadow-md group select-none min-h-[10rem] md:min-h-[10rem]",
                  bloqueadoNoEnvio
                    ? "pointer-events-none cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500 opacity-70 grayscale shadow-none dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-500 scale-none active:!scale-100"
                    : cn(
                        !voteSubmitting && "transition-all active:scale-[0.98]",
                        isMeuVoto ? btn.selected : cn(btn.color, "hover:text-white"),
                        isMeuVoto && !voteSubmitting && "scale-[1.01]"
                      )
                )}
              >
                {showSpinner ? (
                  <Loader2 size={ICON_VOTO} className="animate-spin text-white" />
                ) : (
                  <btn.icon
                    size={ICON_VOTO}
                    className={cn(
                      "transition-all shrink-0",
                      bloqueadoNoEnvio && "!text-slate-400 dark:!text-slate-500",
                      !bloqueadoNoEnvio && (isMeuVoto ? "text-white" : cn("group-hover:text-white", btn.iconColor))
                    )}
                  />
                )}
                <span className="flex flex-col items-center gap-0.5 text-center px-1">
                  {isMeuVoto ? (
                    <>
                      <span className="text-[9px] font-black uppercase tracking-wider opacity-90 leading-tight">
                        Registrado
                      </span>
                      <span className="text-lg md:text-xl font-black uppercase tracking-tight leading-tight">
                        {btn.labelRegistrado}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg md:text-xl font-black uppercase tracking-tight leading-snug">
                      {btn.label}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
      </div>

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
