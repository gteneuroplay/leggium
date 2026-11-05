'use client';

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Tv } from "lucide-react";
import { registrarPresenca, getPainelData, getPainelDataPresidenteMesa } from "./actions";
import { PainelTV } from "./components/PainelTV";
import { PainelOperador } from "./components/PainelOperador";
import { PainelPresidente } from "./components/PainelPresidente";
import { PainelVereador } from "./components/PainelVereador";
import { cn } from "@/lib/utils";
import { rotuloPainelSessao } from "@/lib/sessao-display";
import { reloadOnceIfStaleClientServerAction } from "@/lib/next-stale-server-action";

type ViewProfile = 'tv' | 'operador' | 'presidente' | 'vereador';
type SessaoEventType =
  | "VOTACAO_INICIADA"
  | "VOTACAO_REINICIADA"
  | "VOTO_REGISTRADO"
  | "VOTACAO_ENCERRADA"
  | "PRESENCA_ATUALIZADA"
  | "PALAVRA_SOLICITADA"
  | "PAUTA_ATUALIZADA"
  | "SESSAO_ATUALIZADA";

function normalizePainelInitial(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return {
      sessao: null as any,
      vereadores: [] as any[],
      ordemDoDia: [] as any[],
      votacaoAtiva: null as any,
      votos: [] as any[],
      solicitacoes: [] as any[],
      visitantesTribuna: [] as any[],
      oratoriaTimer: null as any,
      sessionVereadorId: null as string | null,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    sessao: (o.sessao ?? null) as any,
    vereadores: (Array.isArray(o.vereadores) ? o.vereadores : []) as any[],
    ordemDoDia: (Array.isArray(o.ordemDoDia) ? o.ordemDoDia : []) as any[],
    votacaoAtiva: (o.votacaoAtiva ?? null) as any,
    votos: (Array.isArray(o.votos) ? o.votos : []) as any[],
    solicitacoes: (Array.isArray(o.solicitacoes) ? o.solicitacoes : []) as any[],
    visitantesTribuna: (Array.isArray(o.visitantesTribuna) ? o.visitantesTribuna : []) as any[],
    oratoriaTimer: (o.oratoriaTimer ?? null) as any,
    sessionVereadorId: (typeof o.sessionVereadorId === "string" ? o.sessionVereadorId : null) as string | null,
  };
}

export function PainelClient({ 
  initialData, 
  forcedView,
  userProfile,
  mesaToken,
}: { 
  initialData: any, 
  forcedView?: ViewProfile,
  userProfile?: any,
  /** Token do painel da mesa (sem login); só leitura + ações de presidência autorizadas no servidor. */
  mesaToken?: string | null,
}) { 
  const init = normalizePainelInitial(initialData);
  const [sessao, setSessao] = useState(init.sessao);
  const [vereadores] = useState(init.vereadores);
  const [ordemDoDia, setOrdemDoDia] = useState<any[]>(init.ordemDoDia);
  const [votacaoAtiva, setVotacaoAtiva] = useState<any>(init.votacaoAtiva);
  const [votos, setVotos] = useState<any[]>(init.votos);
  const [solicitacoes, setSolicitacoes] = useState<any[]>(init.solicitacoes);
  const [visitantesTribuna, setVisitantesTribuna] = useState<any[]>(init.visitantesTribuna);
  const [oratoriaTimer, setOratoriaTimer] = useState<any>(init.oratoriaTimer);
  const [oratoriaClockSkewMs, setOratoriaClockSkewMs] = useState(0);
  const [sessionVereadorId, setSessionVereadorId] = useState<string | null>(init.sessionVereadorId ?? null);
  const [presencaPendingId, setPresencaPendingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [actingAsVereadorId, setActingAsVereadorId] = useState<string | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  /** Serializa `getPainelData` (poll + SSE + reconcile) para não sobrepor pedidos ao servidor. */
  const refreshChainRef = useRef(Promise.resolve());
  const router = useRouter();

  const isDev = userProfile?.email === 'bergzxgs@gmail.com' || userProfile?.role === 'ADMIN_MASTER';
  const view = forcedView || 'tv';

  /** PWA em TV: mantém o ecrã ligado enquanto o separador estiver visível (quando o browser permitir). */
  useEffect(() => {
    if (view !== "tv" || typeof navigator === "undefined") return;
    const w = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!w.wakeLock?.request) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel?.release?.().catch(() => {});
        sentinel = await w.wakeLock!.request("screen");
      } catch {
        /* permissão negada ou não suportado */
      }
    };
    void acquire();
    const onVisibility = () => {
      void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release?.().catch(() => {});
    };
  }, [view]);

  const effectiveProfile = isDev && actingAsVereadorId 
    ? { ...userProfile, vereador_id: actingAsVereadorId, vereador: { ...userProfile?.vereador, id: actingAsVereadorId } } 
    : userProfile;

  const refreshPainelData = useCallback(async (sessaoId: string) => {
    refreshChainRef.current = refreshChainRef.current
      .then(async () => {
        try {
          const freshData = mesaToken
            ? await getPainelDataPresidenteMesa(sessaoId, mesaToken)
            : await getPainelData(sessaoId, {
                includeTextoCompleto: view === "vereador" || view === "presidente",
              });
          if (freshData) {
            setSessao(freshData.sessao);
            setOrdemDoDia(freshData.ordemDoDia);
            setSolicitacoes(freshData.solicitacoes);
            setVisitantesTribuna(freshData.visitantesTribuna || []);
            setOratoriaTimer(freshData.oratoriaTimer || null);
            const serverNow = freshData.oratoriaTimer?.serverNowMs;
            setOratoriaClockSkewMs(
              typeof serverNow === "number" && Number.isFinite(serverNow) ? serverNow - Date.now() : 0
            );
            setVotacaoAtiva(freshData.votacaoAtiva);
            setVotos(freshData.votos);
            if ("sessionVereadorId" in freshData && freshData.sessionVereadorId !== undefined) {
              setSessionVereadorId(
                typeof freshData.sessionVereadorId === "string" ? freshData.sessionVereadorId : null
              );
            }
          }
        } catch (error) {
          console.error("Erro ao atualizar painel:", error);
          if (reloadOnceIfStaleClientServerAction(error)) return;
        }
      })
      .catch((e) => console.error("[painel] cadeia de refresh:", e));
    await refreshChainRef.current;
  }, [view, mesaToken]);

  /** Atualiza placares na hora, antes da ida/volta do servidor (telão/operador/presidente). */
  const mergeOptimisticVoto = useCallback(
    (votacaoId: string, vereadorId: string, voto: "SIM" | "NAO" | "ABSTENCAO") => {
      setVotos((prev) => {
        const rest = prev.filter((x: { vereador_id?: string }) => x.vereador_id !== vereadorId);
        return [
          ...rest,
          {
            id: `pending:${vereadorId}`,
            votacao_id: votacaoId,
            vereador_id: vereadorId,
            voto,
          },
        ];
      });
    },
    []
  );

  const reconcilePainel = useCallback(async () => {
    if (!sessao?.id) return;
    await refreshPainelData(sessao.id);
  }, [sessao?.id, refreshPainelData]);

  useEffect(() => {
    const serverNow = initialData?.oratoriaTimer?.serverNowMs;
    if (typeof serverNow === "number" && Number.isFinite(serverNow)) {
      setOratoriaClockSkewMs(serverNow - Date.now());
    }
  }, [initialData?.oratoriaTimer?.serverNowMs]);

  /** Deixa a fila responsiva no operador enquanto o backend confirma. */
  const mergeOptimisticSolicitacao = useCallback(
    (vereadorId: string, tipo: "DISCURSO" | "APARTE" | "QUESTAO_ORDEM" = "DISCURSO") => {
      const vereador = vereadores.find((v: { id: string }) => v.id === vereadorId);
      if (!vereador) return;

      setSolicitacoes((prev) => {
        const jaExistePendente = prev.some(
          (s: { vereador_id?: string; tipo?: string; status?: string }) =>
            s.vereador_id === vereadorId &&
            String(s.tipo ?? "").toUpperCase() === tipo &&
            String(s.status ?? "").toUpperCase() === "PENDENTE"
        );
        if (jaExistePendente) return prev;

        return [
          ...prev,
          {
            id: `pending:${vereadorId}:${tipo}:${Date.now()}`,
            sessao_id: sessao?.id,
            vereador_id: vereadorId,
            visitante_id: null,
            tipo,
            status: "PENDENTE",
            created_at: new Date().toISOString(),
            vereador,
          },
        ];
      });
    },
    [vereadores, sessao?.id]
  );

  const mergeOptimisticSolicitacaoVisitante = useCallback((vt: { id: string; nome_completo: string; foto_url?: string | null; representacao?: string | null }) => {
    setSolicitacoes((prev) => {
      const jaExistePendente = prev.some(
        (s: { visitante_id?: string; tipo?: string; status?: string }) =>
          s.visitante_id === vt.id &&
          String(s.tipo ?? "").toUpperCase() === "DISCURSO" &&
          String(s.status ?? "").toUpperCase() === "PENDENTE"
      );
      if (jaExistePendente) return prev;
      return [
        ...prev,
        {
          id: `pending:vt:${vt.id}:DISCURSO:${Date.now()}`,
          sessao_id: sessao?.id,
          vereador_id: null,
          visitante_id: vt.id,
          tipo: "DISCURSO" as const,
          status: "PENDENTE",
          created_at: new Date().toISOString(),
          visitante: vt,
        },
      ];
    });
  }, [sessao?.id]);

  // Realtime (SSE) + polling (operador/presidente mais frequentes — fila de palavra depende disso)
  useEffect(() => {
    if (!sessao?.id) return;

    const sessaoId = sessao.id;
    const pollMs =
      view === "operador"
        ? 2000
        : view === "presidente"
          ? 2500
          : view === "vereador"
            ? 2000
            : 2000;

    const sseQuery = mesaToken ? `?mesaToken=${encodeURIComponent(mesaToken)}` : "";
    const eventSource = new EventSource(`/api/realtime/sessoes/${sessaoId}/events${sseQuery}`);
    const handleRealtimeEvent = async (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data || "{}") as {
          eventId?: string;
          type?: SessaoEventType;
          payload?: Record<string, unknown>;
        };
        if (parsed?.eventId && parsed.eventId === lastEventIdRef.current) return;
        if (parsed?.eventId) lastEventIdRef.current = parsed.eventId;

        const eventType = (parsed?.type || event.type) as SessaoEventType;
        const payload = parsed?.payload || {};
        const eventCreatedAt =
          typeof (parsed as { createdAt?: unknown }).createdAt === "string"
            ? ((parsed as { createdAt: string }).createdAt as string)
            : new Date().toISOString();

        if (eventType === "VOTO_REGISTRADO") {
          const vereadorId = String(payload.vereadorId || "");
          const votacaoId = String(payload.votacaoId || "");
          const voto = String(payload.voto || "") as "SIM" | "NAO" | "ABSTENCAO";
          if (!vereadorId || !votacaoId || !["SIM", "NAO", "ABSTENCAO"].includes(voto)) return;
          setVotos((prev) => {
            const rest = prev.filter((x: { vereador_id?: string }) => x.vereador_id !== vereadorId);
            return [
              ...rest,
              {
                id: `evt:${vereadorId}:${Date.now()}`,
                votacao_id: votacaoId,
                vereador_id: vereadorId,
                voto,
              },
            ];
          });
          return;
        }

        if (eventType === "PALAVRA_SOLICITADA") {
          const vereadorId = String(payload.vereadorId || "");
          const visitanteId = String(payload.visitanteId || "");
          const tipo = (String(payload.tipo || "DISCURSO").toUpperCase() || "DISCURSO") as
            | "DISCURSO"
            | "APARTE"
            | "QUESTAO_ORDEM";
          if (!["DISCURSO", "APARTE", "QUESTAO_ORDEM"].includes(tipo)) return;
          if (!vereadorId && !visitanteId) return;

          if (visitanteId) {
            const snap = payload.visitante as
              | { id?: string; nome_completo?: string; foto_url?: string | null; representacao?: string | null }
              | undefined;
            const visitante = snap?.id
              ? snap
              : {
                  id: visitanteId,
                  nome_completo: String(payload.visitanteNome || "Orador"),
                  foto_url: (payload.visitanteFoto as string | null | undefined) ?? null,
                  representacao: (payload.representacao as string | null | undefined) ?? null,
                };
            setSolicitacoes((prev) => {
              const jaExistePendente = prev.some(
                (s: { visitante_id?: string; tipo?: string; status?: string }) =>
                  s.visitante_id === visitanteId &&
                  String(s.tipo ?? "").toUpperCase() === tipo &&
                  String(s.status ?? "").toUpperCase() === "PENDENTE"
              );
              if (jaExistePendente) return prev;
              return [
                ...prev,
                {
                  id: `evt:vt:${visitanteId}:${tipo}:${Date.now()}`,
                  sessao_id: sessaoId,
                  vereador_id: null,
                  visitante_id: visitanteId,
                  tipo,
                  status: "PENDENTE",
                  created_at: eventCreatedAt,
                  visitante,
                },
              ];
            });
            return;
          }

          const vereador = vereadores.find((v: { id: string }) => v.id === vereadorId);
          setSolicitacoes((prev) => {
            const jaExistePendente = prev.some(
              (s: { vereador_id?: string; tipo?: string; status?: string }) =>
                s.vereador_id === vereadorId &&
                String(s.tipo ?? "").toUpperCase() === tipo &&
                String(s.status ?? "").toUpperCase() === "PENDENTE"
            );
            if (jaExistePendente) return prev;
            return [
              ...prev,
              {
                id: `evt:${vereadorId}:${tipo}:${Date.now()}`,
                sessao_id: sessaoId,
                vereador_id: vereadorId,
                visitante_id: null,
                tipo,
                status: "PENDENTE",
                created_at: eventCreatedAt,
                vereador,
              },
            ];
          });
          return;
        }

        if (eventType === "PRESENCA_ATUALIZADA") {
          const vereadorId = String(payload.vereadorId || "");
          const tipo = String(payload.tipo || "").toUpperCase();
          if (!vereadorId || !tipo) return;
          setSessao((prev: any) => {
            if (!prev) return prev;
            const presencas = Array.isArray(prev.presencas) ? prev.presencas : [];
            const idx = presencas.findIndex((p: { vereador_id?: string }) => p.vereador_id === vereadorId);
            if (idx >= 0) {
              const next = [...presencas];
              next[idx] = { ...next[idx], status: tipo };
              return { ...prev, presencas: next };
            }
            return {
              ...prev,
              presencas: [
                ...presencas,
                {
                  id: `evt:presenca:${vereadorId}:${Date.now()}`,
                  sessao_id: sessaoId,
                  vereador_id: vereadorId,
                  status: tipo,
                },
              ],
            };
          });
          return;
        }

        if (eventType === "SESSAO_ATUALIZADA") {
          await refreshPainelData(sessaoId);
          return;
        }

        // Eventos estruturais ainda fazem refresh completo para manter consistência global.
        if (
          eventType === "VOTACAO_INICIADA" ||
          eventType === "VOTACAO_REINICIADA" ||
          eventType === "VOTACAO_ENCERRADA" ||
          eventType === "PAUTA_ATUALIZADA"
        ) {
          await refreshPainelData(sessaoId);
          return;
        }
      } catch {
        await refreshPainelData(sessaoId);
      }
    };
    eventSource.onmessage = handleRealtimeEvent;
    eventSource.addEventListener("VOTACAO_INICIADA", handleRealtimeEvent);
    eventSource.addEventListener("VOTACAO_REINICIADA", handleRealtimeEvent);
    eventSource.addEventListener("VOTO_REGISTRADO", handleRealtimeEvent);
    eventSource.addEventListener("VOTACAO_ENCERRADA", handleRealtimeEvent);
    eventSource.addEventListener("PRESENCA_ATUALIZADA", handleRealtimeEvent);
    eventSource.addEventListener("PALAVRA_SOLICITADA", handleRealtimeEvent);
    eventSource.addEventListener("PAUTA_ATUALIZADA", handleRealtimeEvent);
    eventSource.addEventListener("SESSAO_ATUALIZADA", handleRealtimeEvent);
    eventSource.addEventListener("connected", () => undefined);
    eventSource.addEventListener("ping", () => undefined);
    eventSource.onerror = () => {
      // Fallback fica responsável quando stream cair.
    };

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      await refreshPainelData(sessaoId);
    };

    const interval = setInterval(poll, pollMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
      eventSource.close();
    };
  }, [sessao?.id, view, refreshPainelData, vereadores, mesaToken]);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMarcarPresenca = async (vereadorId: string) => {
    if (!sessao) return;

    const presencaAtual = sessao.presencas?.find((p: any) => p.vereador_id === vereadorId);
    const novoStatus = presencaAtual && presencaAtual.status !== "AUSENTE" ? "AUSENTE" : "PRESENTE";

    setPresencaPendingId(vereadorId);
    try {
      await registrarPresenca(sessao.id, novoStatus, vereadorId);
    } catch (e) {
      if (reloadOnceIfStaleClientServerAction(e)) return;
      console.error(e);
    } finally {
      setPresencaPendingId(null);
    }
  };

  const renderView = () => {
    if (!sessao) return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
        <div className="premium-panel p-20 rounded-xl shadow-2xl border border-border flex flex-col items-center">
          <Clock size={80} className="text-slate-200 dark:text-slate-800 mb-8" />
          <h2 className="text-4xl font-black text-foreground mb-4 uppercase tracking-tighter">Nenhuma Sessão Ativa</h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">O painel será ativado assim que uma sessão for iniciada.</p>
        </div>
      </div>
    );

    switch (view) {
      case 'operador': return <PainelOperador sessao={sessao} vereadores={vereadores} visitantesTribuna={visitantesTribuna} onMarcarPresenca={handleMarcarPresenca} presencaPendingId={presencaPendingId} ordemDoDia={ordemDoDia} votacaoAtiva={votacaoAtiva} votos={votos} solicitacoes={solicitacoes} oratoriaTimer={oratoriaTimer} oratoriaClockSkewMs={oratoriaClockSkewMs} mergeOptimisticSolicitacao={mergeOptimisticSolicitacao} mergeOptimisticSolicitacaoVisitante={mergeOptimisticSolicitacaoVisitante} reconcilePainel={reconcilePainel} />;
      case 'presidente':
        return (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PainelPresidente sessao={sessao} vereadores={vereadores} ordemDoDia={ordemDoDia} votacaoAtiva={votacaoAtiva} votos={votos} solicitacoes={solicitacoes} oratoriaTimer={oratoriaTimer} oratoriaClockSkewMs={oratoriaClockSkewMs} mesaToken={mesaToken ?? null} userProfile={effectiveProfile} mergeOptimisticVoto={mergeOptimisticVoto} reconcilePainel={reconcilePainel} sessionVereadorId={sessionVereadorId} />
          </div>
        );
      case 'vereador':
        return (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden">
            <PainelVereador
              sessao={sessao}
              ordemDoDia={ordemDoDia}
              votacaoAtiva={votacaoAtiva}
              votos={votos}
              solicitacoes={solicitacoes}
              oratoriaTimer={oratoriaTimer}
              oratoriaClockSkewMs={oratoriaClockSkewMs}
              userProfile={effectiveProfile}
              mergeOptimisticVoto={mergeOptimisticVoto}
              reconcilePainel={reconcilePainel}
            />
          </div>
        );
      default: return <PainelTV sessao={sessao} vereadores={vereadores} ordemDoDia={ordemDoDia} votacaoAtiva={votacaoAtiva} votos={votos} solicitacoes={solicitacoes} oratoriaTimer={oratoriaTimer} oratoriaClockSkewMs={oratoriaClockSkewMs} />;
    }
  };

  const barraCompactaVereador = isDev ? (
    <div className="mb-2 flex shrink-0 justify-end">
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1">
        <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider whitespace-nowrap">
          Simulação
        </span>
        <select
          value={actingAsVereadorId || ""}
          onChange={(e) => setActingAsVereadorId(e.target.value || null)}
          className="max-w-[140px] sm:max-w-[200px] bg-transparent text-foreground text-[10px] font-black border-0 rounded-lg focus:ring-0 py-0.5 uppercase tracking-tight truncate"
        >
          <option value="" className="bg-panel">
            Perfil real
          </option>
          {vereadores.map((v: any) => (
            <option key={v.id} value={v.id} className="bg-panel">
              {v.nome_parlamentar || v.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-hidden bg-background px-3 py-3 lg:px-4 lg:py-3">
      {view === "vereador" ? (
        barraCompactaVereador
      ) : view === "tv" || view === "presidente" ? null : (
        <div
          className={cn(
            "premium-panel border-border shadow-xl shrink-0",
            view === "operador"
              ? "flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 px-4 py-3 rounded-xl"
              : "flex flex-col md:flex-row items-center justify-between gap-6 mb-6 p-6 rounded-xl"
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20",
                view === "operador" ? "p-2.5" : "p-4 rounded-xl"
              )}
            >
              <Tv size={view === "operador" ? 22 : 28} className="text-white" />
            </div>
            <div>
              <h1
                className={cn(
                  "font-black text-foreground uppercase tracking-tighter leading-none",
                  view === "operador" ? "text-lg md:text-xl" : "text-2xl"
                )}
              >
                SysLegis Panel
              </h1>
              <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1.5">
                {rotuloPainelSessao(sessao)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div
              className={cn(
                "flex items-center gap-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-border shadow-inner",
                view === "operador" ? "px-4 py-2" : "px-8 py-3 rounded-xl"
              )}
            >
              <div className="text-right">
                <p className="text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest mb-0.5">
                  Relógio Oficial
                </p>
                <p
                  className={cn(
                    "font-mono font-black text-foreground leading-none tabular-nums tracking-tighter",
                    view === "operador" ? "text-lg md:text-xl" : "text-2xl"
                  )}
                >
                  {mounted && currentTime
                    ? currentTime.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "--:--:--"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex-1 min-h-0 min-w-0 overflow-x-hidden",
          view === "operador"
            ? "overflow-y-auto lg:overflow-y-hidden lg:overflow-hidden overscroll-contain"
            : view === "vereador" || view === "presidente"
              ? "flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain min-h-0"
              : "overflow-hidden"
        )}
      >
        {renderView()}
      </div>
    </div>
  );
}
