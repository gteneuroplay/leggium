"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPainelObsData } from "@/app/obs/actions";
import { cn } from "@/lib/utils";
import {
  nomeOradorSolicitacao,
  fotoOradorSolicitacao,
  pickOradorEmFala,
  cargoOradorSolicitacao,
  isOradorPresidenteMesa,
} from "@/lib/painel/orador-display";
import { ObsTransparentChrome } from "@/components/obs/ObsTransparentChrome";
import { reloadOnceIfStaleClientServerAction } from "@/lib/next-stale-server-action";
import { useOratoriaLastMinuteAlert } from "@/hooks/use-oratoria-last-minute-alert";
import { computeTempoRestanteOratoriaSec } from "@/lib/painel/oratoria-tempo-restante";

type SessaoEventType =
  | "VOTACAO_INICIADA"
  | "VOTACAO_REINICIADA"
  | "VOTO_REGISTRADO"
  | "VOTACAO_ENCERRADA"
  | "PRESENCA_ATUALIZADA"
  | "PALAVRA_SOLICITADA"
  | "PAUTA_ATUALIZADA"
  | "SESSAO_ATUALIZADA";

function proposicaoEmDestaque(ordemDoDia: any[], votacaoAtiva: any) {
  if (votacaoAtiva?.proposicao_id) {
    return ordemDoDia.find((i) => i.proposicao_id === votacaoAtiva.proposicao_id)?.proposicao;
  }
  return ordemDoDia.find((i) => i.status_discussao === "EM_DISCUSSAO")?.proposicao;
}

function linhaTickerProjeto(ordemDoDia: any[], votacaoAtiva: any): string {
  const p = proposicaoEmDestaque(ordemDoDia || [], votacaoAtiva);
  if (!p) {
    return "Aguardando definição da matéria em pauta nesta sessão legislativa.";
  }
  const cab =
    p.tipo && (p.numero != null || p.ano != null)
      ? `${p.tipo} ${p.numero ?? "—"}/${p.ano ?? "—"}`
      : p.tipo || "Matéria";
  const ementa = String(p.ementa || "").trim();
  return ementa ? `${cab} — ${ementa}` : `${cab}.`;
}

export function ObsOratoriaOverlayClient({
  sessaoId,
  initialData,
}: {
  sessaoId: string;
  initialData: any;
}) {
  const [solicitacoes, setSolicitacoes] = useState<any[]>(initialData.solicitacoes || []);
  const [oratoriaTimer, setOratoriaTimer] = useState<any>(initialData.oratoriaTimer || null);
  const [oratoriaClockSkewMs, setOratoriaClockSkewMs] = useState(0);
  const [ordemDoDia, setOrdemDoDia] = useState<any[]>(initialData.ordemDoDia || []);
  const [votacaoAtiva, setVotacaoAtiva] = useState<any>(initialData.votacaoAtiva ?? null);
  const [vereadores] = useState<any[]>(initialData.vereadores || []);
  const [agora, setAgora] = useState(Date.now());
  const lastEventIdRef = useRef<string | null>(null);
  const refreshChainRef = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    refreshChainRef.current = refreshChainRef.current
      .then(async () => {
        try {
          const fresh = await getPainelObsData(sessaoId);
          setSolicitacoes(fresh.solicitacoes || []);
          setOratoriaTimer(fresh.oratoriaTimer || null);
          const serverNow = fresh.oratoriaTimer?.serverNowMs;
          setOratoriaClockSkewMs(
            typeof serverNow === "number" && Number.isFinite(serverNow) ? serverNow - Date.now() : 0
          );
          setOrdemDoDia(fresh.ordemDoDia || []);
          setVotacaoAtiva(fresh.votacaoAtiva ?? null);
        } catch (e) {
          console.error("[obs oratoria]", e);
          if (reloadOnceIfStaleClientServerAction(e)) return;
        }
      })
      .catch(() => {});
    await refreshChainRef.current;
  }, [sessaoId]);

  const oradorAtual = useMemo(() => pickOradorEmFala(solicitacoes), [solicitacoes]);
  const semLimiteTempo =
    Boolean(oratoriaTimer?.semLimiteTempo) ||
    (!!oradorAtual && isOradorPresidenteMesa(oradorAtual));
  const mostrarCronometroOratoria = !!oradorAtual && !semLimiteTempo;

  const tempo = useMemo(() => {
    if (!mostrarCronometroOratoria) return 0;
    return computeTempoRestanteOratoriaSec(oratoriaTimer, agora, oratoriaClockSkewMs);
  }, [mostrarCronometroOratoria, oratoriaTimer, agora, oratoriaClockSkewMs]);

  const isRunning = Boolean(oratoriaTimer?.isRunning);
  const oratoriaMin = String(Math.floor(tempo / 60)).padStart(2, "0");
  const oratoriaSeg = String(tempo % 60).padStart(2, "0");

  useOratoriaLastMinuteAlert({
    enabled: mostrarCronometroOratoria,
    tempoSec: tempo,
    isRunning,
    semLimiteTempo,
    speakerSolicitacaoId: oratoriaTimer?.speakerSolicitacaoId ?? null,
  });

  useEffect(() => {
    const serverNow = initialData?.oratoriaTimer?.serverNowMs;
    if (typeof serverNow === "number" && Number.isFinite(serverNow)) {
      setOratoriaClockSkewMs(serverNow - Date.now());
    }
  }, [initialData?.oratoriaTimer?.serverNowMs]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 2000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    const es = new EventSource(`/api/realtime/sessoes/${sessaoId}/events`);
    const onMsg = async (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data || "{}") as {
          eventId?: string;
          type?: SessaoEventType;
        };
        if (parsed?.eventId && parsed.eventId === lastEventIdRef.current) return;
        if (parsed?.eventId) lastEventIdRef.current = parsed.eventId;
        const eventType = (parsed?.type || ev.type) as SessaoEventType;
        if (
          eventType === "PALAVRA_SOLICITADA" ||
          eventType === "SESSAO_ATUALIZADA" ||
          eventType === "PAUTA_ATUALIZADA" ||
          eventType === "VOTACAO_INICIADA" ||
          eventType === "VOTACAO_REINICIADA" ||
          eventType === "VOTACAO_ENCERRADA"
        ) {
          await refresh();
        }
      } catch {
        await refresh();
      }
    };
    es.onmessage = onMsg;
    es.addEventListener("PALAVRA_SOLICITADA", onMsg);
    es.addEventListener("SESSAO_ATUALIZADA", onMsg);
    es.addEventListener("PAUTA_ATUALIZADA", onMsg);
    es.addEventListener("VOTACAO_INICIADA", onMsg);
    es.addEventListener("VOTACAO_REINICIADA", onMsg);
    es.addEventListener("VOTACAO_ENCERRADA", onMsg);
    es.addEventListener("connected", () => undefined);
    es.addEventListener("ping", () => undefined);
    es.onerror = () => {};
    return () => es.close();
  }, [sessaoId, refresh]);

  const fotoOrador = oradorAtual ? fotoOradorSolicitacao(oradorAtual, vereadores) : "/placeholder-user.jpg";
  const cargoOrador = oradorAtual ? cargoOradorSolicitacao(oradorAtual, vereadores) : "";
  const nome = oradorAtual ? nomeOradorSolicitacao(oradorAtual) : "";
  const vid = oradorAtual?.vereador_id as string | undefined;
  const partido =
    vid && vereadores.length
      ? (vereadores.find((v: { id: string }) => v.id === vid)?.partido as string) || ""
      : "";

  const speakerKey =
    oradorAtual?.id ??
    (oradorAtual?.vereador_id || oradorAtual?.visitante_id
      ? `v:${oradorAtual?.vereador_id ?? ""}:${oradorAtual?.visitante_id ?? ""}`
      : "idle");

  const tickerText = linhaTickerProjeto(ordemDoDia, votacaoAtiva);
  const pAtual = proposicaoEmDestaque(ordemDoDia, votacaoAtiva);
  const tickerAnimKey = `${pAtual?.id ?? "none"}:${votacaoAtiva?.id ?? "nv"}`;
  const tickerDurationSec = Math.min(180, Math.max(42, tickerText.length * 0.22));

  return (
    <ObsTransparentChrome>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex w-full flex-col items-stretch">
        <div className="flex justify-center px-3 pb-1.5 pt-0 md:px-6 md:pb-2">
        <div
          key={speakerKey}
          className={cn(
            "flex w-full max-w-[1600px] items-stretch gap-4 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-r from-slate-950/92 via-slate-900/88 to-slate-950/92 px-4 py-3 shadow-[0_12px_48px_rgba(0,0,0,0.55)] backdrop-blur-md md:gap-6 md:rounded-3xl md:px-8 md:py-5",
            "animate-in fade-in slide-in-from-bottom-4 duration-500",
          )}
        >
          {oradorAtual ? (
            <>
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/25 shadow-lg md:h-[100px] md:w-[100px] md:rounded-2xl">
                <img src={fotoOrador} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-blue-300/90 md:text-xs">
                  {semLimiteTempo
                    ? isOradorPresidenteMesa(oradorAtual)
                      ? "Mesa diretora"
                      : "Uso da palavra"
                    : "Orador em tribuna"}
                </p>
                <p className="truncate text-xl font-black uppercase leading-tight tracking-tight text-white md:text-3xl">
                  {nome}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {partido ? (
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 md:text-xs">
                      {partido}
                    </span>
                  ) : null}
                  {cargoOrador ? (
                    <span className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-200 md:text-sm">
                      {cargoOrador}
                    </span>
                  ) : null}
                </div>
              </div>
              {mostrarCronometroOratoria ? (
                <div className="flex shrink-0 flex-col items-end justify-center border-l border-white/15 pl-3 md:pl-5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 md:text-[10px]">
                    Tempo
                  </span>
                  <span className="mt-1 font-mono text-2xl font-black tabular-nums tracking-tight text-white md:text-4xl">
                    {oratoriaMin}:{oratoriaSeg}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex w-full items-center justify-center py-2 text-center animate-in fade-in duration-400">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400 md:text-base">
                Nenhum orador em tribuna
              </p>
            </div>
          )}
        </div>
        </div>

        <div
          className="w-full border-t border-white/15 bg-slate-950/70 shadow-[0_-6px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex w-full min-h-0 items-center gap-3 px-3 py-2.5 md:gap-4 md:px-5 md:py-3">
            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 md:text-xs md:tracking-[0.18em]">
              Pauta
            </span>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden py-0.5">
              <div
                key={tickerAnimKey}
                className="obs-marquee-track text-base font-semibold leading-normal tracking-normal text-slate-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] md:text-lg lg:text-xl"
                style={{ animationDuration: `${tickerDurationSec}s` }}
              >
                <span className="whitespace-nowrap pr-16 md:pr-28">{tickerText}</span>
                <span className="whitespace-nowrap pr-16 md:pr-28" aria-hidden>
                  {tickerText}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ObsTransparentChrome>
  );
}
