'use client';

import { Users, Vote, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useOratoriaLastMinuteAlert } from "@/hooks/use-oratoria-last-minute-alert";
import { computeTempoRestanteOratoriaSec, type OratoriaTimerLike } from "@/lib/painel/oratoria-tempo-restante";
import { cn } from "@/lib/utils";
import {
  nomeOradorSolicitacao,
  fotoOradorSolicitacao,
  pickOradorEmFala,
  cargoOradorSolicitacao,
  isOradorPresidenteMesa,
} from "@/lib/painel/orador-display";

type Presenca = {
  vereador_id?: string | null;
  status?: string | null;
};

type SessaoLike = {
  presencas?: Presenca[] | null;
};

type VereadorLike = {
  id: string;
  nome: string;
  nome_parlamentar?: string | null;
  partido?: string | null;
  foto_url?: string | null;
  cargo_mesa?: string | null;
};

type ProposicaoLike = {
  tipo?: string | null;
  numero?: string | number | null;
  ano?: string | number | null;
  ementa?: string | null;
};

type OrdemDoDiaItem = {
  proposicao_id?: string | null;
  status_discussao?: string | null;
  proposicao?: ProposicaoLike | null;
};

type VotacaoAtivaLike = {
  proposicao_id?: string | null;
};

type VotoLike = {
  vereador_id?: string | null;
  voto?: "SIM" | "NAO" | "ABSTENCAO" | null;
};

type OratoriaTimerSnapshot = OratoriaTimerLike & {
  speakerSolicitacaoId?: string | null;
};

type SolicitacaoLike = {
  status?: string | null;
  vereador_id?: string | null;
  visitante_id?: string | null;
  vereador?: { nome_parlamentar?: string | null; cargo_mesa?: string | null; foto_url?: string | null } | null;
  visitante?: { nome_completo?: string | null; representacao?: string | null; foto_url?: string | null } | null;
};

export function PainelTV({ 
  sessao, 
  vereadores,
  ordemDoDia,
  votacaoAtiva,
  votos,
  solicitacoes = [],
  oratoriaTimer,
  oratoriaClockSkewMs = 0,
}: { 
  sessao: SessaoLike; 
  vereadores: VereadorLike[]; 
  ordemDoDia: OrdemDoDiaItem[];
  votacaoAtiva: VotacaoAtivaLike | null;
  votos: VotoLike[];
  solicitacoes?: SolicitacaoLike[];
  oratoriaTimer?: OratoriaTimerSnapshot | null;
  oratoriaClockSkewMs?: number;
}) {
  const [agora, setAgora] = useState(0);
  const totalPresentes = sessao.presencas?.filter((p) => p.status !== 'AUSENTE').length || 0;
  
  const sim = votos.filter(v => v.voto === 'SIM').length;
  const nao = votos.filter(v => v.voto === 'NAO').length;
  const absteve = votos.filter(v => v.voto === 'ABSTENCAO').length;

  const proposicaoAtual = votacaoAtiva 
    ? ordemDoDia.find(i => i.proposicao_id === votacaoAtiva.proposicao_id)?.proposicao 
    : ordemDoDia.find(i => i.status_discussao === 'EM_DISCUSSAO')?.proposicao;
  const oradorAtual = pickOradorEmFala(solicitacoes);
  const semLimiteTempo =
    Boolean(oratoriaTimer?.semLimiteTempo) ||
    (!!oradorAtual && isOradorPresidenteMesa(oradorAtual));
  const fotoOrador = oradorAtual ? fotoOradorSolicitacao(oradorAtual, vereadores) : "/placeholder-user.jpg";
  const cargoOrador = oradorAtual ? cargoOradorSolicitacao(oradorAtual, vereadores) : "";
  const mostrarCronometroOratoria = !!oradorAtual && !semLimiteTempo;
  const isRunning = Boolean(oratoriaTimer?.isRunning);
  const tempo = mostrarCronometroOratoria
    ? computeTempoRestanteOratoriaSec(oratoriaTimer, agora, oratoriaClockSkewMs ?? 0)
    : 0;
  const oratoriaMin = String(Math.floor(tempo / 60)).padStart(2, "0");
  const oratoriaSeg = String(tempo % 60).padStart(2, "0");
  const ALERTA_FINAL_SEGUNDOS = 60;
  const timerParado = mostrarCronometroOratoria && !isRunning && tempo > 0;
  const timerFinalizando = mostrarCronometroOratoria && tempo <= ALERTA_FINAL_SEGUNDOS;
  const timerClasse = timerParado
    ? "border-amber-300/55 bg-gradient-to-r from-amber-600/90 via-amber-500/85 to-yellow-500/85"
    : timerFinalizando
      ? "border-red-300/60 bg-gradient-to-r from-red-700/90 via-red-600/85 to-rose-600/85"
        : "border-emerald-300/55 bg-gradient-to-r from-emerald-700/90 via-emerald-600/85 to-green-600/85";

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useOratoriaLastMinuteAlert({
    enabled: Boolean(oradorAtual && mostrarCronometroOratoria),
    tempoSec: tempo,
    isRunning,
    semLimiteTempo,
    speakerSolicitacaoId: oratoriaTimer?.speakerSolicitacaoId ?? null,
  });

  return (
    <div className="painel-tv flex h-full min-h-0 flex-col gap-3 pb-3 relative">
      {oradorAtual && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center p-3 md:p-6 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-[1500px] max-h-[calc(100vh-24px)] md:max-h-[calc(100vh-48px)] overflow-y-auto rounded-[2rem] border border-blue-300/30 bg-gradient-to-br from-[#020b2c]/95 via-[#07123a]/92 to-[#130b3a]/92 backdrop-blur-xl shadow-2xl px-6 py-6 md:px-10 md:py-8">
            <p className="text-base md:text-xl font-black uppercase tracking-[0.28em] text-blue-200 text-center">
              Oratória em andamento
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-7">
              <div className="mx-auto h-[220px] w-[220px] md:h-[280px] md:w-[280px] lg:h-[360px] lg:w-[360px] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900">
                <img
                  src={fotoOrador}
                  alt={oradorAtual ? nomeOradorSolicitacao(oradorAtual) : "Orador"}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 w-full flex flex-col items-center justify-center text-center">
                <p className="text-4xl md:text-6xl lg:text-7xl font-black text-white uppercase tracking-tight leading-[0.92] text-center break-words">
                  {oradorAtual ? nomeOradorSolicitacao(oradorAtual) : "Orador"}
                </p>
                {cargoOrador ? (
                  <p className="mt-3 max-w-[95%] md:max-w-[90%] lg:max-w-[1100px] mx-auto text-lg md:text-2xl lg:text-3xl font-bold text-blue-100/95 text-center leading-snug line-clamp-3 normal-case tracking-tight">
                    {cargoOrador}
                  </p>
                ) : null}
                {mostrarCronometroOratoria ? (
                  <>
                    <p className="mt-4 text-base md:text-2xl lg:text-3xl font-black uppercase tracking-[0.16em] text-blue-200/90 text-center">
                      Tempo oficial de fala
                    </p>
                    <div className="mt-6 flex justify-center w-full">
                      <div
                        className={cn(
                          "w-full max-w-[95%] md:max-w-[90%] lg:max-w-[860px] rounded-3xl border px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 shadow-2xl",
                          timerClasse,
                        )}
                      >
                        <span className="block w-full text-center text-5xl md:text-7xl lg:text-[8.75rem] font-mono font-black text-white tabular-nums tracking-tight leading-none">
                          {oratoriaMin}:{oratoriaSeg}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Topo - Info do Projeto e Placar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 premium-panel p-5 lg:p-6 rounded-xl border border-border shadow-xl min-h-[132px] flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <FileText size={120} />
          </div>
          
          {proposicaoAtual ? (
            <div className="flex flex-col gap-2 relative z-10">
              <span className="text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.25em] text-[11px] mb-0.5">
                {votacaoAtiva ? "• Votação em Curso" : "• Em Discussão na Pauta"}
              </span>
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black text-foreground leading-tight uppercase tracking-tighter">
                {proposicaoAtual.tipo} {proposicaoAtual.numero}/{proposicaoAtual.ano}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base md:text-lg font-bold line-clamp-2 italic max-w-4xl">
                {proposicaoAtual.ementa}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4 opacity-40">
               <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-xl border border-border">
                <FileText size={48} className="text-foreground" />
               </div>
               <h1 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tighter">Aguardando Início dos Trabalhos Legislativos</h1>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 premium-panel p-4 lg:p-5 rounded-xl border border-border shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 flex flex-col items-center justify-center">
              <CheckCircle2 size={26} className="text-emerald-600 dark:text-emerald-400" />
              <p className="text-3xl xl:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter leading-none mt-2">{sim}</p>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">SIM</span>
            </div>
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 flex flex-col items-center justify-center">
              <XCircle size={26} className="text-red-600 dark:text-red-400" />
              <p className="text-3xl xl:text-4xl font-black text-red-600 dark:text-red-400 tracking-tighter leading-none mt-2">{nao}</p>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">NÃO</span>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 flex flex-col items-center justify-center">
              <AlertCircle size={26} className="text-amber-600 dark:text-amber-400" />
              <p className="text-3xl xl:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tighter leading-none mt-2">{absteve}</p>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">ABS</span>
            </div>
            <div className="rounded-xl border border-blue-500/25 bg-blue-600/10 p-3 flex flex-col items-center justify-center">
              <Users size={26} className="text-blue-600 dark:text-blue-400" />
              <p className="text-3xl xl:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter leading-none mt-2">{totalPresentes}</p>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 block">PRES</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Vereadores */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {vereadores.map((v) => {
            const presenca = sessao.presencas?.find((p) => p.vereador_id === v.id);
            const isPresente = presenca && presenca.status !== 'AUSENTE';
            const voto = votos.find(vt => vt.vereador_id === v.id)?.voto;

            return (
              <div 
                key={v.id}
                className={cn(
                  "relative group overflow-hidden rounded-[1.25rem] border transition-all duration-500 h-[clamp(160px,24vh,280px)] shadow-lg",
                  isPresente 
                    ? 'premium-panel border-border hover:border-blue-500/50 hover:shadow-blue-500/10' 
                    : 'bg-slate-50 dark:bg-white/5 border-border opacity-30 grayscale scale-[0.98]',
                  votacaoAtiva && isPresente && voto === "SIM" && "border-emerald-500/80 shadow-emerald-500/20",
                  votacaoAtiva && isPresente && voto === "NAO" && "border-red-500/80 shadow-red-500/20",
                  votacaoAtiva && isPresente && voto === "ABSTENCAO" && "border-amber-500/80 shadow-amber-500/20"
                )}
              >
                {/* Foto com Efeito Premium */}
                        <img
                  src={v.foto_url || "/placeholder-user.jpg"} 
                  alt={v.nome}
                  className={cn(
                            "absolute inset-0 w-full h-full object-contain bg-slate-950 transition-all duration-700 group-hover:scale-105",
                    isPresente ? "scale-100" : "scale-95"
                  )}
                />
                
                {/* Overlay Adaptativo */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent dark:from-slate-950 dark:via-slate-950/40" />
                
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[92%] z-10">
                  <h3 className="text-white font-black text-base md:text-lg xl:text-xl leading-tight truncate tracking-tight drop-shadow-md text-center">
                    {v.nome_parlamentar || v.nome}
                  </h3>
                  <div className="flex items-center justify-center mt-1.5">
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.18em] drop-shadow-sm">{v.partido}</span>
                  </div>
                </div>

                {/* Overlay de Voto - Identificadores Visuais Fortes */}
                {votacaoAtiva && isPresente && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[5px] animate-in zoom-in spin-in-12 duration-500 z-20">
                    {voto === 'SIM' ? (
                      <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl shadow-emerald-950/50 border border-white/20 flex items-center gap-2.5">
                        <CheckCircle2 size={34} />
                        <span className="text-xs font-black uppercase tracking-wider">SIM</span>
                      </div>
                    ) : voto === 'NAO' ? (
                      <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-2xl shadow-red-950/50 border border-white/20 flex items-center gap-2.5">
                        <XCircle size={34} />
                        <span className="text-xs font-black uppercase tracking-wider">NÃO</span>
                      </div>
                    ) : voto === 'ABSTENCAO' ? (
                      <div className="bg-amber-500 text-white px-4 py-3 rounded-xl shadow-2xl shadow-amber-950/50 border border-white/20 flex items-center gap-2.5">
                        <AlertCircle size={34} />
                        <span className="text-xs font-black uppercase tracking-wider">ABS</span>
                      </div>
                    ) : (
                      <div className="bg-white/10 backdrop-blur-xl px-4 py-3 rounded-xl border border-white/20 animate-pulse shadow-xl flex items-center gap-2.5">
                         <Vote size={32} className="text-white/50" />
                         <span className="text-xs font-black uppercase tracking-wider text-white/80">Aguard.</span>
                      </div>
                    )}
                  </div>
                )}

                {isPresente && (
                  <div className="absolute top-3 left-3 z-20">
                    <div className="px-2.5 py-1 bg-emerald-500/90 backdrop-blur-md rounded-md border border-emerald-300/40 flex items-center gap-1 shadow-md">
                      <span className="text-[8px] font-black text-white uppercase tracking-wider">PRESENTE</span>
                    </div>
                  </div>
                )}
                
                {/* Indicador de Ausência */}
                {!isPresente && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="bg-slate-950/60 backdrop-blur-sm px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.3em] border border-white/10">AUSENTE</span>
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
