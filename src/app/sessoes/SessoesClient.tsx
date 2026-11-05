"use client";

import { useState, useMemo } from "react";
import { 
  CalendarDays, Plus, Search, Edit2, Trash2, 
  Clock, Users, FileText, 
  CheckCircle2, AlertCircle, Calendar as CalendarIcon, Play
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { upsertSessao, deleteSessao, updateSessaoStatus, getSessoes } from "./actions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: any = {
  'AGENDADA': { label: 'Agendada', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-600/10 dark:bg-blue-400/10', border: 'border-blue-600/20 dark:border-blue-400/20', icon: CalendarIcon },
  'ABERTA': { label: 'Em Andamento', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-600/10 dark:bg-emerald-400/10', border: 'border-emerald-600/20 dark:border-emerald-400/20', icon: Play },
  'ENCERRADA': { label: 'Finalizada', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-600/10 dark:bg-slate-400/10', border: 'border-slate-600/20 dark:border-slate-400/20', icon: CheckCircle2 },
};

const TIPOS_SESSAO_MAP: any = {
  "ORDINARIA": "Sessão Ordinária",
  "EXTRAORDINARIA": "Sessão Extraordinária",
  "SOLENE": "Sessão Solene",
  "AUDIENCIA_PUBLICA": "Audiência Pública"
};

const TIPOS_SESSAO = Object.keys(TIPOS_SESSAO_MAP);

/** Valor de `<input type="datetime-local">` (sem fuso). No browser, `new Date(...)` usa o relógio local. */
function naiveLocalToUtcIso(naive: string): string {
  const t = naive.trim();
  if (!t) return naive;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return naive;
  return d.toISOString();
}

/** Instante guardado na BD → string para datetime-local no fuso do dispositivo. */
function instantToDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SessoesClient({ initialData }: { initialData: any[] }) {
  const [sessoes, setSessoes] = useState(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    tipo: "ORDINARIA",
    data_inicio: "",
    status: "AGENDADA",
    numero_sessao: "",
    secao_legislativa: "",
  });

  const proximoNumeroSugerido = useMemo(() => {
    if (!sessoes.length) return 1;
    return Math.max(0, ...sessoes.map((s: any) => Number(s.numero_sessao) || 0)) + 1;
  }, [sessoes]);

  const filteredData = sessoes.filter((s) => {
    const q = searchTerm.toLowerCase();
    const sec = String(s.secao_legislativa ?? "").toLowerCase();
    const num = String(s.numero_sessao ?? "");
    return (
      s.tipo.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q) ||
      sec.includes(q) ||
      num.includes(q)
    );
  });

  const syncSessoes = async () => {
    try {
      const fresh = await getSessoes();
      setSessoes(fresh);
    } catch {
      // Mantém estado atual em caso de falha de sincronização.
    }
  };

  const handleToggleSessaoStatus = async (sessao: any) => {
    try {
      if (sessao.status === "AGENDADA") {
        await updateSessaoStatus(sessao.id, "ABERTA");
        await syncSessoes();
        toast.success("Sessão aberta com sucesso!");
      } else if (sessao.status === "ABERTA") {
        await updateSessaoStatus(sessao.id, "ENCERRADA");
        await syncSessoes();
        toast.success("Sessão encerrada com sucesso!");
      } else if (sessao.status === "ENCERRADA") {
        await updateSessaoStatus(sessao.id, "ABERTA");
        await syncSessoes();
        toast.success("Sessão reaberta com sucesso!");
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar status da sessão.");
    }
  };

  const handleOpenModal = (sessao?: any, startNow: boolean = false) => {
    if (sessao) {
      setEditingId(sessao.id);
      const date = new Date(sessao.data_sessao);
      const formattedDate = instantToDatetimeLocalValue(date);
      
      setFormData({
        tipo: sessao.tipo,
        data_inicio: formattedDate,
        status: sessao.status,
        numero_sessao: String(sessao.numero_sessao ?? ""),
        secao_legislativa: sessao.secao_legislativa ?? "",
      });
    } else {
      setEditingId(null);
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const nowFormatted = now.toISOString().slice(0, 16);

      setFormData({
        tipo: "ORDINARIA",
        data_inicio: startNow ? nowFormatted : "",
        status: startNow ? "ABERTA" : "AGENDADA",
        numero_sessao: String(proximoNumeroSugerido),
        secao_legislativa: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertSessao({
        ...formData,
        id: editingId,
        data_inicio: naiveLocalToUtcIso(formData.data_inicio),
      });
      await syncSessoes();
      setIsModalOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Não foi possível salvar a sessão. Verifique os dados e tente novamente.";
      setAlertModal({
        title: "Erro ao salvar",
        message: msg,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 shadow-sm sm:p-3">
            <CalendarDays className="h-7 w-7 text-blue-600 dark:text-blue-400 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Sessões plenárias
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Agendamento e gestão das reuniões legislativas.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            onClick={() => handleOpenModal(null, true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 premium-transition"
          >
            <Play className="h-4 w-4 fill-current" />
            Iniciar Sessão agora
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 premium-transition"
          >
            <Plus className="h-4 w-4" />
            Agendar Sessão
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por tipo ou status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full premium-input rounded-xl py-3 pl-12 pr-4 shadow-sm"
        />
      </div>

      {/* Listagem Estilo Timeline */}
      <div className="flex-1 space-y-4">
        {filteredData.length === 0 ? (
          <div className="premium-panel rounded-xl p-20 text-center">
            <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma sessão agendada.</p>
          </div>
        ) : (
          filteredData.map((s) => {
            const status = STATUS_CONFIG[s.status] || STATUS_CONFIG['AGENDADA'];
            const StatusIcon = status.icon;
            const sessionDate = new Date(s.data_sessao);
            const totalPresentes = Array.isArray(s.presencas)
              ? s.presencas.filter((p: any) => p.status !== "AUSENTE").length
              : 0;
            const totalPauta = Array.isArray(s.ordem_do_dia) ? s.ordem_do_dia.length : 0;
            const resultadosPauta = Array.isArray(s.ordem_do_dia)
              ? s.ordem_do_dia
                  .map((item: any) => String(item?.proposicao?.status || "").toUpperCase())
                  .filter((status: string) => status === "APROVADO" || status === "REJEITADO")
              : [];
            const votacoesEncerradas = Array.isArray(s.votacoes)
              ? s.votacoes.filter((v: any) => String(v.status).toUpperCase() === "ENCERRADA")
              : [];
            // Considera só o resultado final por proposição (evita contar rodadas de teste/reinício separadamente).
            const latestByProposicao = new Map<string, any>();
            for (const v of votacoesEncerradas) {
              const pid = String(v.proposicao_id || "");
              if (!pid) continue;
              if (!latestByProposicao.has(pid)) latestByProposicao.set(pid, v);
            }
            const votacoesFinaisPorProposicao = Array.from(latestByProposicao.values());
            const ultimoResultado = resultadosPauta.length
              ? resultadosPauta[resultadosPauta.length - 1]
              : votacoesFinaisPorProposicao[0]
                ? String(votacoesFinaisPorProposicao[0].resultado_calculado || "").toUpperCase()
                : "";
            const historicoResultados = resultadosPauta.length
              ? resultadosPauta
              : votacoesFinaisPorProposicao
                  .map((v: any) => String(v.resultado_calculado || "").toUpperCase())
                  .filter((r: string) => r === "APROVADO" || r === "REJEITADO");

            return (
              <div key={s.id} className="premium-panel p-5 rounded-xl hover:border-blue-500/40 transition-all duration-300 group relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 opacity-0 group-hover:opacity-100 premium-transition" />
                
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex gap-6">
                    {/* Data Block */}
                    <div className="flex flex-col items-center justify-center min-w-[80px] h-[80px] rounded-xl bg-slate-100 dark:bg-white/5 border border-border shadow-inner">
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{format(sessionDate, "MMM", { locale: ptBR })}</span>
                      <span className="text-3xl font-black text-foreground">{format(sessionDate, "dd")}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${status.bg} ${status.color} border ${status.border}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-blue-500/50" />
                          {format(sessionDate, "HH:mm'h'")}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md border border-blue-500/25 bg-blue-600/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          Sessão nº {s.numero_sessao}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-foreground leading-tight tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {TIPOS_SESSAO_MAP[s.tipo] || s.tipo}
                      </h3>
                      {s.secao_legislativa ? (
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300 leading-snug max-w-2xl">
                          {String(s.secao_legislativa)}
                        </p>
                      ) : null}
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {format(sessionDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>

                      <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>Quórum: <span className="text-foreground/70">{totalPresentes} presentes</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span>Pauta: <span className="text-foreground/70">{totalPauta} itens</span></span>
                        </div>
                        {s.status === "ENCERRADA" && ultimoResultado && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2
                              className={cn(
                                "h-3.5 w-3.5",
                                ultimoResultado === "APROVADO" ? "text-emerald-500" : "text-red-500"
                              )}
                            />
                            <span>
                              Resultado:{" "}
                              <span
                                className={cn(
                                  "text-foreground/80",
                                  ultimoResultado === "APROVADO" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                )}
                              >
                                {ultimoResultado}
                              </span>
                            </span>
                          </div>
                        )}
                        {s.status === "ENCERRADA" && historicoResultados.length > 1 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span>Histórico:</span>
                            {historicoResultados.map((resultado: string, idx: number) => (
                              <span
                                key={`${s.id}-hist-${idx}`}
                                className={cn(
                                  "px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider",
                                  resultado === "APROVADO"
                                    ? "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : "bg-red-600/15 text-red-600 dark:text-red-400 border-red-500/30"
                                )}
                              >
                                {resultado}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                    <button onClick={() => handleOpenModal(s)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                      <Edit2 className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button onClick={() => setDeleteConfirmId(s.id)} className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleToggleSessaoStatus(s)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                        s.status === "AGENDADA" || s.status === "ENCERRADA"
                          ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20"
                          : "bg-red-600/10 text-red-600 border border-red-600/30 hover:bg-red-600 hover:text-white"
                      )}
                    >
                      {s.status === "AGENDADA" && (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          ABRIR SESSÃO
                        </>
                      )}
                      {s.status === "ABERTA" && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5" />
                          ENCERRAR SESSÃO
                        </>
                      )}
                      {s.status === "ENCERRADA" && (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          REABRIR SESSÃO
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Sessão" : "Agendar Nova Sessão"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo de Sessão</label>
            <select
              required
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
            >
              {TIPOS_SESSAO.map((t) => (
                <option key={t} value={t} className="bg-panel text-foreground">{TIPOS_SESSAO_MAP[t]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Número da sessão <span className="font-normal text-slate-500">(único por câmara)</span>
            </label>
            <input
              type="number"
              min={1}
              required
              value={formData.numero_sessao}
              onChange={(e) => setFormData({ ...formData, numero_sessao: e.target.value })}
              className="w-full premium-input rounded-xl py-3 px-4 shadow-sm tabular-nums"
            />
            {!editingId && (
              <p className="text-[11px] text-slate-500">
                Sugestão automática: próximo livre após a última sessão registada. Pode alterar se o regimento exigir outra numeração.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Seção / designação legislativa <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <input
              type="text"
              value={formData.secao_legislativa}
              onChange={(e) => setFormData({ ...formData, secao_legislativa: e.target.value })}
              placeholder='Ex.: 1ª Sessão Ordinária — 2026 · Seção II'
              maxLength={300}
              className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
            />
            <p className="text-[11px] text-slate-500">
              Aparece no painel plenário e nas listagens para identificar o período ou a fase legislativa.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Data e Horário de Início</label>
            <input
              type="datetime-local"
              required
              value={formData.data_inicio}
              onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
            />
          </div>

          {editingId && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status da Sessão</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]: [string, any]) => (
                  <option key={key} value={key} className="bg-panel text-foreground">{config.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all active:scale-95"
            >
              Salvar Sessão
            </button>
          </div>
        </form>
      </Modal>

      <BlockingModal
        isOpen={alertModal !== null}
        onClose={() => setAlertModal(null)}
        mode="alert"
        title={alertModal?.title ?? ""}
        message={alertModal?.message ?? ""}
      />

      <BlockingModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        mode="confirm"
        danger
        title="Excluir sessão?"
        message="Deseja realmente excluir esta sessão? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteSessao(deleteConfirmId);
            await syncSessoes();
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir a sessão." });
          }
        }}
      />
    </div>
  );
}
