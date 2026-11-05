"use client";

import { useEffect, useState } from "react";
import { 
  FileText, 
  Scale, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  ChevronRight,
  MessageSquare,
  History,
  FileCheck,
  Loader2,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rotuloAutoriaProposicao, iniciaisAutoriaProposicao } from "@/lib/proposicao-autoria";
import {
  adicionarNotaProposicao,
  adminDefinirComissaoParaProposicao,
  getNotasProposicao,
  getNotasResumoTramitacao,
  marcarNotasComoLidas,
  adminTramitarDiretoParaPauta,
  registrarParecer,
  updateProposicaoStatus
} from "../proposicoes/actions";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { createPortal } from "react-dom";

const PdfViewer = dynamic(() => import('./PdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-20 text-blue-500 gap-3">
      <Loader2 size={32} className="animate-spin" />
      <span className="text-sm font-bold uppercase tracking-widest">Iniciando Visualizador...</span>
    </div>
  )
});

export function TramitacaoClient({ 
  initialProposicoes, 
  comissoes,
  user,
  usuarios = [],
  setores = []
}: { 
  initialProposicoes: any[], 
  comissoes: any[],
  user: any,
  usuarios?: any[],
  setores?: any[]
}) {
  const normalizeSearch = (value?: string) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const normalizeSetor = (value?: string) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

  const setorNormalizado = normalizeSetor(user?.profile?.setor?.nome);
  const isJuridicoSetor = setorNormalizado === "JURIDICO";
  const isComissaoSetor = setorNormalizado === "COMISSAO";
  const isAdministradorSetor = setorNormalizado === "ADMINISTRADOR" || user?.profile?.role === "ADMIN_MASTER" || user?.profile?.role === "DEV";
  const vereadorId = user?.profile?.vereador?.id as string | undefined;
  const parecerTipoPadrao = isJuridicoSetor ? "JURIDICO" : isComissaoSetor ? "COMISSAO" : "JURIDICO";

  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const selectedProp = initialProposicoes.find(p => p.id === selectedPropId) || null;
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showNotasModal, setShowNotasModal] = useState(false);
  const [notas, setNotas] = useState<Array<{
    id: string;
    conteudo: string;
    created_at: Date | string;
    autor_nome: string | null;
    autor_id: string;
  }>>([]);
  const [notaTexto, setNotaTexto] = useState("");
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [loadingEnvioNota, setLoadingEnvioNota] = useState(false);
  const [notasResumo, setNotasResumo] = useState<Record<string, { total: number; unread: number }>>({});
  const [comissaoEncaminhamentoId, setComissaoEncaminhamentoId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const isDev = user?.email === 'bergzxgs@gmail.com' || user?.profile?.role === 'ADMIN_MASTER';

  const [parecerData, setParecerData] = useState({
    tipo_parecer: parecerTipoPadrao,
    comissao_id: '',
    conclusao: 'FAVORAVEL',
    texto_parecer: '',
    autor_id: '',
    proximo_setor_id: '',
    marcar_pronto_pauta: false
  });

  const router = useRouter();

  const term = normalizeSearch(searchTerm);
  const filtered = initialProposicoes.filter((p) => {
    if (!term) return true;
    const searchable = normalizeSearch(
      `${p.ementa || ""} ${p.tipo || ""} ${p.numero || ""}/${p.ano || ""} ${rotuloAutoriaProposicao(p)}`
    );
    return searchable.includes(term);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getComissaoReferida = (proposicao: any) => {
    const juridicos = (proposicao?.pareceres || [])
      .filter((par: any) => par.tipo_parecer === "JURIDICO" && par.comissao_id)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return juridicos[0]?.comissao_id || null;
  };

  const comissaoReferidaId = selectedProp ? getComissaoReferida(selectedProp) : null;
  const comissaoReferida = comissoes.find((c: any) => c.id === comissaoReferidaId) || null;
  const hasParecerJuridico = Boolean(
    selectedProp?.pareceres?.some((par: any) => par.tipo_parecer === "JURIDICO")
  );
  const hasParecerComissao = Boolean(
    selectedProp?.pareceres?.some((par: any) => par.tipo_parecer === "COMISSAO")
  );
  const canFinalizarPauta = hasParecerComissao;
  const canDiretoPauta = !hasParecerJuridico;
  const comissaoParecerId = parecerData.tipo_parecer === "COMISSAO"
    ? (comissaoReferidaId || parecerData.comissao_id || "")
    : parecerData.comissao_id;
  const comissaoParecer = comissoes.find((c: any) => c.id === comissaoParecerId) || null;
  const isPresidenteDaComissaoParecer = Boolean(
    vereadorId &&
    comissaoParecer?.presidente_id &&
    comissaoParecer.presidente_id === vereadorId
  );

  const loadResumoNotas = async () => {
    try {
      const ids = initialProposicoes.map((p) => p.id);
      if (!ids.length) return;
      const resumo = await getNotasResumoTramitacao(ids);
      setNotasResumo(resumo || {});
    } catch {
      // Não bloqueia a tela principal caso a leitura de badges falhe.
    }
  };

  const loadNotas = async (proposicaoId: string) => {
    setLoadingNotas(true);
    try {
      const data = await getNotasProposicao(proposicaoId);
      setNotas(data.notas || []);
      await marcarNotasComoLidas(proposicaoId);
      await loadResumoNotas();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível carregar as notas.");
    } finally {
      setLoadingNotas(false);
    }
  };

  const handleAbrirNotas = async () => {
    if (!selectedProp) return;
    setShowNotasModal(true);
    await loadNotas(selectedProp.id);
  };

  const handleEnviarNota = async () => {
    if (!selectedProp) return;
    const conteudo = notaTexto.trim();
    if (!conteudo) {
      toast.error("Digite o conteúdo da nota.");
      return;
    }

    setLoadingEnvioNota(true);
    try {
      await adicionarNotaProposicao({
        proposicao_id: selectedProp.id,
        conteudo
      });
      setNotaTexto("");
      await loadNotas(selectedProp.id);
      toast.success("Nota enviada com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar nota.");
    } finally {
      setLoadingEnvioNota(false);
    }
  };

  useEffect(() => {
    loadResumoNotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleRegistrarParecer = async () => {
    if (!selectedProp) return;
    if (parecerData.tipo_parecer === 'COMISSAO' && !comissaoParecerId) {
      toast.error("A comissão ainda não foi definida pelo Administrador.");
      return;
    }
    if (
      parecerData.tipo_parecer === "COMISSAO" &&
      !isAdministradorSetor &&
      !isDev &&
      !isPresidenteDaComissaoParecer
    ) {
      toast.error("Somente o presidente da comissão definida pode registrar este parecer.");
      return;
    }
    if (!parecerData.texto_parecer) {
      toast.error("O texto do parecer é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      await registrarParecer({
        proposicao_id: selectedProp.id,
        ...parecerData,
        comissao_id: comissaoParecerId || undefined
      });

      if (parecerData.marcar_pronto_pauta) {
        await updateProposicaoStatus(selectedProp.id, 'PRONTO_PARA_PAUTA');
      }

      toast.success("Parecer e movimentação registrados com sucesso!");
      setShowModal(false);
      
      setParecerData({
        tipo_parecer: parecerTipoPadrao,
        comissao_id: '',
        conclusao: 'FAVORAVEL',
        texto_parecer: '',
        autor_id: '',
        proximo_setor_id: '',
        marcar_pronto_pauta: false
      });

      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar parecer.");
    } finally {
      setLoading(false);
    }
  };

  const handleTramitarDiretoParaPauta = async () => {
    if (!selectedProp) return;
    if (!isAdministradorSetor) {
      toast.error("Somente o Administrador pode executar esta ação.");
      return;
    }

    setLoading(true);
    try {
      await adminTramitarDiretoParaPauta(selectedProp.id);
      toast.success("Proposição tramitada diretamente para pauta.");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível tramitar diretamente para pauta.");
    } finally {
      setLoading(false);
    }
  };

  const handleDefinirComissao = async () => {
    if (!selectedProp) return;
    if (!isAdministradorSetor) {
      toast.error("Apenas o Administrador pode definir a comissão.");
      return;
    }
    if (!comissaoEncaminhamentoId) {
      toast.error("Selecione uma comissão para encaminhamento.");
      return;
    }
    setLoading(true);
    try {
      await adminDefinirComissaoParaProposicao(selectedProp.id, comissaoEncaminhamentoId);
      toast.success("Comissão definida e proposição encaminhada para parecer da comissão.");
      setComissaoEncaminhamentoId("");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível definir a comissão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      {/* Header e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter">Tramitação Legislativa</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Análise jurídica e pareceres das comissões permanentes.</p>
        </div>

        <div className="relative group max-w-md w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
          <input 
            type="text" 
            placeholder="Buscar por número, tipo ou ementa..."
            className="w-full premium-input rounded-xl py-4 pl-14 pr-6 shadow-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden min-h-0">
        {/* Lista de Proposições */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {filtered.length} projeto{filtered.length === 1 ? "" : "s"} encontrado{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Por página</span>
              <select
                className="premium-input rounded-lg py-1 px-2 text-xs font-black"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 premium-panel rounded-xl border-dashed opacity-40">
              <FileText size={64} className="mb-4 text-slate-400" />
              <p className="font-black uppercase tracking-widest text-xs text-slate-500">Nenhum projeto pendente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
            {paginated.map((p) => {
              const resumoNotas = notasResumo[p.id] || { total: 0, unread: 0 };
              return (
              <button
                key={p.id}
                onClick={() => setSelectedPropId(p.id)}
                className={cn(
                  "w-full text-left p-3.5 rounded-xl border transition-all group relative overflow-hidden",
                  selectedProp?.id === p.id 
                    ? "bg-blue-600/5 border-blue-500/30 shadow-md" 
                    : "bg-slate-900/30 border-white/10 hover:border-blue-500/25 hover:bg-slate-900/40"
                )}
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <span className="px-2.5 py-0.5 bg-blue-600/10 text-blue-400 rounded-md text-[9px] font-bold uppercase tracking-[0.14em] border border-blue-500/20">
                    {p.tipo.replace(/_/g, ' ')} {p.numero}/{p.ano}
                  </span>
                  <div className={cn(
                    "px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-[0.14em] border",
                    p.status === 'PROTOCOLADO' ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                  )}>
                    {String(p.status || "").replace(/_/g, " ")}
                  </div>
                </div>
                <h3 className="text-foreground/95 font-semibold text-[14px] leading-snug line-clamp-2 group-hover:text-blue-300 transition-colors">
                  {p.ementa}
                </h3>
                <div className="flex items-center gap-2 mt-2.5 text-slate-400">
                  <div className="w-6 h-6 rounded-full bg-slate-100/10 border border-white/10 flex items-center justify-center text-[8px] font-bold uppercase text-blue-300">
                    {iniciaisAutoriaProposicao(p)}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{rotuloAutoriaProposicao(p)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-300">
                    {resumoNotas.total} nota{resumoNotas.total === 1 ? "" : "s"}
                  </span>
                  {resumoNotas.unread > 0 && (
                    <span className="px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-600/10 text-[9px] font-bold uppercase tracking-[0.12em] text-blue-400">
                      {resumoNotas.unread} nova{resumoNotas.unread === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Clique para abrir detalhes
                </div>
                <ChevronRight className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-blue-500 transition-all",
                  selectedProp?.id === p.id && "text-blue-500 translate-x-1"
                )} />
              </button>
              );
            })}
            </div>
          )}
          {filtered.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3 px-1 pb-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-black uppercase tracking-widest text-slate-500 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-black uppercase tracking-widest text-slate-500 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </div>

        {/* Detalhes e Ações */}
        <div className="lg:col-span-7 h-full flex flex-col overflow-hidden">
          {selectedProp ? (
            <div className="flex-1 premium-panel rounded-xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-border bg-slate-50/50 dark:bg-white/5">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-2">
                      {selectedProp.tipo.replace(/_/g, ' ')} {selectedProp.numero}/{selectedProp.ano}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">{selectedProp.ementa}</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (selectedProp.pdf_url) {
                        setShowPdfModal(true);
                      } else {
                        toast.error("O PDF oficial desta proposição ainda não foi gerado.");
                      }
                    }}
                    className={cn(
                      "p-4 rounded-xl transition-all shadow-lg active:scale-95 group relative",
                      selectedProp.pdf_url 
                        ? "bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-600 border border-border" 
                        : "bg-slate-50 dark:bg-white/5 text-slate-400 cursor-not-allowed border border-border opacity-50"
                    )}
                  >
                    <FileText size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Timeline */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History size={16} className="text-blue-500" /> Histórico de Tramitação
                  </h4>
                  <div className="space-y-6 border-l-2 border-border ml-2 pl-6">
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-blue-600 shadow-lg shadow-blue-600/30" />
                      <p className="text-foreground text-sm font-black uppercase tracking-tight">Criação do Projeto</p>
                      <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase">{new Date(selectedProp.created_at).toLocaleDateString()}</p>
                    </div>
                    {(selectedProp.tramitacoes || []).map((t: any) => (
                      <div className="relative" key={t.id}>
                        <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                        <p className="text-foreground text-sm font-black uppercase tracking-tight">
                          {(t.acao || "TRAMITACAO").replace(/_/g, " ")}
                        </p>
                        <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase">
                          {new Date(t.created_at).toLocaleString("pt-BR")}
                          {t.usuario?.nome ? ` - ${t.usuario.nome}` : ""}
                        </p>
                        <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase">
                          {t.origem_setor?.sigla || t.origem_setor?.nome || "ORIGEM"} {"->"} {t.destino_setor?.sigla || t.destino_setor?.nome || "DESTINO"}
                        </p>
                        {t.despacho_texto && (
                          <p className="text-slate-400 text-[11px] mt-2 leading-relaxed normal-case font-semibold">
                            {t.despacho_texto}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className={cn(
                     "p-6 rounded-xl border flex flex-col items-center justify-center text-center transition-all",
                     selectedProp.pareceres?.some((par: any) => par.tipo_parecer === 'JURIDICO')
                       ? "border-emerald-500/40 bg-emerald-500/5 shadow-inner"
                       : "border-border border-dashed bg-slate-50 dark:bg-white/5 opacity-50"
                   )}>
                      <Scale size={36} className={cn("mb-3", selectedProp.pareceres?.some((par: any) => par.tipo_parecer === 'JURIDICO') ? "text-emerald-500" : "text-slate-400")} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parecer Jurídico</p>
                      <span className="text-xs font-black text-foreground mt-1">
                        {selectedProp.pareceres?.find((par: any) => par.tipo_parecer === 'JURIDICO')?.conclusao || "AGUARDANDO"}
                      </span>
                   </div>
                   <div className={cn(
                     "p-6 rounded-xl border flex flex-col items-center justify-center text-center transition-all",
                     selectedProp.pareceres?.some((par: any) => par.tipo_parecer === 'COMISSAO')
                       ? "border-emerald-500/40 bg-emerald-500/5 shadow-inner"
                       : "border-border border-dashed bg-slate-50 dark:bg-white/5 opacity-50"
                   )}>
                      <Building2 size={36} className={cn("mb-3", selectedProp.pareceres?.some((par: any) => par.tipo_parecer === 'COMISSAO') ? "text-emerald-500" : "text-slate-400")} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parecer Comissão</p>
                      <span className="text-xs font-black text-foreground mt-1">
                        {selectedProp.pareceres?.find((par: any) => par.tipo_parecer === 'COMISSAO')?.conclusao || "PENDENTE"}
                      </span>
                   </div>
                </div>

                {/* Detalhamento dos Pareceres */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <FileCheck size={16} className="text-emerald-500" /> Pareceres Registrados
                  </h4>

                  {!selectedProp.pareceres || selectedProp.pareceres.length === 0 ? (
                    <div className="p-5 rounded-xl border border-dashed border-border text-xs font-semibold text-slate-500">
                      Nenhum parecer textual registrado até o momento.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedProp.pareceres.map((parecer: any) => (
                        <div
                          key={parecer.id}
                          className="rounded-xl border border-border bg-white/50 dark:bg-white/5 p-5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-md border border-blue-500/20 bg-blue-600/10 text-[10px] font-black uppercase tracking-widest text-blue-500">
                              {(parecer.tipo_parecer || "PARECER").replace(/_/g, " ")}
                            </span>
                            <span className={cn(
                              "px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-widest",
                              parecer.conclusao === "FAVORAVEL"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                                : parecer.conclusao === "CONTRARIO"
                                  ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                                  : "border-amber-500/20 bg-amber-500/10 text-amber-500"
                            )}>
                              {parecer.conclusao?.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              {parecer.autor?.nome || "Autor não informado"}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              {parecer.created_at ? new Date(parecer.created_at).toLocaleString("pt-BR") : ""}
                            </span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {parecer.texto_parecer || "Sem conteúdo textual."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isAdministradorSetor && hasParecerJuridico && !comissaoReferidaId && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-600/5 p-5 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                      Fluxo: Jurídico -&gt; Admin -&gt; Comissão
                    </h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      O parecer jurídico já foi emitido. Agora o Administrador deve escolher a comissão para seguir o fluxo.
                    </p>
                    <div className="flex flex-col md:flex-row gap-3">
                      <select
                        className="flex-1 premium-input rounded-xl py-3 px-4 shadow-sm"
                        value={comissaoEncaminhamentoId}
                        onChange={(e) => setComissaoEncaminhamentoId(e.target.value)}
                      >
                        <option value="" className="bg-panel text-foreground">Selecione a comissão...</option>
                        {comissoes.map((c: any) => (
                          <option key={c.id} value={c.id} className="bg-panel text-foreground">{c.sigla} - {c.nome}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleDefinirComissao}
                        disabled={loading}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg disabled:opacity-60"
                      >
                        Definir Comissão
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50/50 dark:bg-white/5 border-t border-border flex gap-4">
                {!isAdministradorSetor && (
                  <button 
                    onClick={() => setShowModal(true)}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <FileCheck size={20} /> REGISTRAR NOVO PARECER
                  </button>
                )}
                {isAdministradorSetor && selectedProp.status !== "PRONTO_PARA_PAUTA" && selectedProp.status !== "EM_PAUTA" && (
                  <>
                    {canFinalizarPauta ? (
                      <button
                        onClick={handleTramitarDiretoParaPauta}
                        disabled={loading}
                        className="flex-1 py-4 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-emerald-500/30 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-60"
                      >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> ENCAMINHAR PARA PAUTA</>}
                      </button>
                    ) : canDiretoPauta ? (
                      <button
                        onClick={handleTramitarDiretoParaPauta}
                        disabled={loading}
                        className="flex-1 py-4 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-emerald-500/30 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-60"
                      >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> DIRETO PARA PAUTA</>}
                      </button>
                    ) : hasParecerJuridico && !comissaoReferidaId ? (
                      <div className="flex-1 py-4 px-4 rounded-xl border border-blue-500/20 bg-blue-600/5 text-blue-500 text-[11px] font-black uppercase tracking-widest flex items-center justify-center text-center">
                        Defina a comissão para continuar o fluxo
                      </div>
                    ) : (
                      <div className="flex-1 py-4 px-4 rounded-xl border border-amber-500/20 bg-amber-600/5 text-amber-500 text-[11px] font-black uppercase tracking-widest flex items-center justify-center text-center">
                        Aguardando parecer da comissão
                      </div>
                    )}
                  </>
                )}
                <button
                  onClick={handleAbrirNotas}
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 text-foreground font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-border flex items-center justify-center gap-3 active:scale-95"
                >
                  <MessageSquare size={20} /> NOTAS
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] border border-border">
                    {notasResumo[selectedProp.id]?.total || 0}
                  </span>
                  {(notasResumo[selectedProp.id]?.unread || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-600/10 text-blue-500 text-[10px] border border-blue-500/20">
                      {notasResumo[selectedProp.id].unread} nova{notasResumo[selectedProp.id].unread === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20 premium-panel rounded-xl opacity-30 border-dashed">
              <Scale size={100} className="mb-8 text-slate-400" />
              <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Selecione um Projeto</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mt-3 font-medium">Clique em uma proposição na lista ao lado para iniciar a análise jurídica ou técnica.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes da Proposição */}
      {showDetalhesModal && selectedProp && (
        createPortal(<div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-6xl h-[90vh] premium-panel rounded-xl shadow-[0_32px_128px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex justify-between items-start gap-4 bg-slate-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">
                  {selectedProp.tipo.replace(/_/g, " ")} {selectedProp.numero}/{selectedProp.ano}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">{selectedProp.ementa}</p>
              </div>
              <button
                onClick={() => setShowDetalhesModal(false)}
                className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-slate-400 hover:text-red-500"
              >
                <XCircle size={30} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <History size={16} className="text-blue-500" /> Histórico de Tramitação
                </h4>
                <div className="space-y-4 border-l-2 border-border ml-2 pl-6">
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-blue-600 shadow-lg shadow-blue-600/30" />
                    <p className="text-foreground text-sm font-black uppercase tracking-tight">Criação do Projeto</p>
                    <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase">{new Date(selectedProp.created_at).toLocaleDateString()}</p>
                  </div>
                  {(selectedProp.tramitacoes || []).map((t: any) => (
                    <div className="relative" key={t.id}>
                      <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                      <p className="text-foreground text-sm font-black uppercase tracking-tight">{(t.acao || "TRAMITACAO").replace(/_/g, " ")}</p>
                      <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase">
                        {new Date(t.created_at).toLocaleString("pt-BR")}{t.usuario?.nome ? ` - ${t.usuario.nome}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 dark:bg-white/5 border-t border-border flex gap-3">
              {!isAdministradorSetor && (
                <button
                  onClick={() => { setShowDetalhesModal(false); setShowModal(true); }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <FileCheck size={18} /> REGISTRAR NOVO PARECER
                </button>
              )}
              {isAdministradorSetor && selectedProp.status !== "PRONTO_PARA_PAUTA" && selectedProp.status !== "EM_PAUTA" && (
                <button
                  onClick={handleTramitarDiretoParaPauta}
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> ENCAMINHAR PARA PAUTA</>}
                </button>
              )}
              <button
                onClick={handleAbrirNotas}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-foreground font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-border flex items-center justify-center gap-2"
              >
                <MessageSquare size={18} /> NOTAS
              </button>
              <button
                onClick={() => {
                  if (selectedProp.pdf_url) setShowPdfModal(true);
                  else toast.error("O PDF oficial desta proposição ainda não foi gerado.");
                }}
                className="px-5 py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-blue-500/20 flex items-center justify-center gap-2"
              >
                <FileText size={18} /> LER PROJETO
              </button>
            </div>
          </div>
        </div>, document.body)
      )}

      {/* Modal de Parecer */}
      {showModal && (
        createPortal(<div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-3xl premium-panel rounded-xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Novo Parecer & Movimentação</h3>
                <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                  {selectedProp?.tipo} {selectedProp?.numero}/{selectedProp?.ano}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-slate-400 hover:text-red-500"
              >
                <XCircle size={32} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Parecer</label>
                  <select 
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                    value={parecerData.tipo_parecer}
                    onChange={(e) => setParecerData({...parecerData, tipo_parecer: e.target.value})}
                    disabled={isJuridicoSetor || isComissaoSetor}
                  >
                    <option value="JURIDICO" className="bg-panel text-foreground">Procuradoria Jurídica</option>
                    <option value="COMISSAO" className="bg-panel text-foreground">Comissão Permanente</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Conclusão</label>
                  <select 
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                    value={parecerData.conclusao}
                    onChange={(e) => setParecerData({...parecerData, conclusao: e.target.value})}
                  >
                    <option value="FAVORAVEL" className="bg-panel text-foreground">Favorável</option>
                    <option value="CONTRARIO" className="bg-panel text-foreground">Contrário</option>
                    <option value="COM_RESSALVAS" className="bg-panel text-foreground">Favorável com Ressalvas</option>
                  </select>
                </div>

                {parecerData.tipo_parecer === 'COMISSAO' && (
                  <div className="col-span-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Comissão Responsável</label>
                    {isAdministradorSetor ? (
                      <select
                        className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                        value={parecerData.comissao_id}
                        onChange={(e) => setParecerData({...parecerData, comissao_id: e.target.value})}
                      >
                        <option value="" className="bg-panel text-foreground">Selecione uma comissão...</option>
                        {comissoes.map((c: any) => (
                          <option key={c.id} value={c.id} className="bg-panel text-foreground">{c.sigla} - {c.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full premium-input rounded-xl py-3 px-4 shadow-sm text-sm">
                        {comissaoReferida ? `${comissaoReferida.sigla} - ${comissaoReferida.nome}` : "Comissão não definida pelo Administrador"}
                      </div>
                    )}
                    {!isAdministradorSetor && comissaoReferida && !isPresidenteDaComissaoParecer && (
                      <p className="text-[11px] font-bold text-amber-500">
                        Apenas o presidente da comissão definida pode concluir este parecer.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {parecerData.tipo_parecer === "JURIDICO" && isAdministradorSetor && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Definir Comissão de Encaminhamento</label>
                  <select
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                    value={parecerData.comissao_id}
                    onChange={(e) => setParecerData({...parecerData, comissao_id: e.target.value})}
                  >
                    <option value="" className="bg-panel text-foreground">Selecione a comissão para votação...</option>
                    {comissoes.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-panel text-foreground">{c.sigla} - {c.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {isAdministradorSetor && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Encaminhar Para (Opcional)</label>
                  <select
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                    value={parecerData.proximo_setor_id}
                    onChange={(e) => setParecerData({...parecerData, proximo_setor_id: e.target.value})}
                  >
                    <option value="" className="bg-panel text-foreground">Manter no setor atual</option>
                    {setores.map((s: any) => (
                      <option key={s.id} value={s.id} className="bg-panel text-foreground">{s.nome} ({s.sigla})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Conteúdo do Parecer</label>
                <textarea 
                  rows={4}
                  placeholder="Descreva aqui a fundamentação do parecer..."
                  className="w-full premium-input rounded-xl py-4 px-4 shadow-sm"
                  value={parecerData.texto_parecer}
                  onChange={(e) => setParecerData({...parecerData, texto_parecer: e.target.value})}
                />
              </div>

              {isAdministradorSetor && (
                <div className="flex items-center gap-3 p-5 bg-blue-500/5 rounded-xl border border-blue-500/10">
                  <input
                    type="checkbox"
                    id="prontoPauta"
                    className="w-5 h-5 rounded-lg border-border bg-panel text-blue-600 focus:ring-0"
                    checked={parecerData.marcar_pronto_pauta}
                    onChange={(e) => setParecerData({...parecerData, marcar_pronto_pauta: e.target.checked})}
                  />
                  <label htmlFor="prontoPauta" className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter cursor-pointer">
                    Marcar como PRONTO PARA PAUTA (Finaliza tramitação)
                  </label>
                </div>
              )}

              {isDev && (
                <div className="space-y-2 bg-amber-500/5 p-5 rounded-xl border border-amber-500/10">
                  <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">Simular Autor (Modo Dev)</label>
                  <select 
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                    value={parecerData.autor_id}
                    onChange={(e) => setParecerData({...parecerData, autor_id: e.target.value})}
                  >
                    <option value="" className="bg-panel text-foreground">Seu Perfil Atual</option>
                    {usuarios.map((u: any) => (
                      <option key={u.id} value={u.id} className="bg-panel text-foreground">{u.nome} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50/50 dark:bg-white/5 border-t border-border flex gap-4">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-black uppercase tracking-widest text-xs transition-all"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleRegistrarParecer}
                disabled={loading}
                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><FileCheck size={20} /> FINALIZAR PARECER</>}
              </button>
            </div>
          </div>
        </div>, document.body)
      )}

      {/* Modal de Visualização de PDF */}
      {showPdfModal && selectedProp?.pdf_url && (
        createPortal(<div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-6xl h-[90vh] premium-panel rounded-xl shadow-[0_32px_128px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-600">
                  <FileText size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">
                    Leitura da Proposição
                  </h3>
                  <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                    {selectedProp.tipo.replace(/_/g, ' ')} {selectedProp.numero}/{selectedProp.ano}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="p-3 hover:bg-red-500/10 rounded-full transition-colors text-slate-400 hover:text-red-500"
              >
                <XCircle size={40} />
              </button>
            </div>
            
            <div className="flex-1 bg-slate-100/50 dark:bg-slate-900/20 p-8 overflow-y-auto custom-scrollbar">
              <PdfViewer url={selectedProp.pdf_url} />
            </div>
          </div>
        </div>, document.body)
      )}

      {/* Modal de Notas */}
      {showNotasModal && selectedProp && (
        createPortal(<div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-4xl h-[85vh] premium-panel rounded-xl shadow-[0_32px_128px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Notas da Tramitação</h3>
                <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                  {selectedProp.tipo.replace(/_/g, " ")} {selectedProp.numero}/{selectedProp.ano}
                </p>
              </div>
              <button
                onClick={() => setShowNotasModal(false)}
                className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-slate-400 hover:text-red-500"
              >
                <XCircle size={32} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-100/30 dark:bg-slate-900/10">
              {loadingNotas ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <Loader2 className="animate-spin mr-2" /> Carregando notas...
                </div>
              ) : notas.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                  Ainda não há notas para esta proposição.
                </div>
              ) : (
                notas.map((nota) => {
                  const isMine = nota.autor_id === user?.profile?.id;
                  return (
                    <div
                      key={nota.id}
                      className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3 border shadow-sm",
                        isMine
                          ? "ml-auto bg-blue-600/10 border-blue-500/20"
                          : "mr-auto bg-white/60 dark:bg-white/5 border-border"
                      )}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        {nota.autor_nome || "Usuário"} - {new Date(nota.created_at).toLocaleString("pt-BR")}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{nota.conteudo}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-border bg-slate-50/50 dark:bg-white/5 flex gap-3">
              <textarea
                rows={3}
                placeholder="Escreva uma nota para a tramitação..."
                className="flex-1 premium-input rounded-xl py-3 px-4"
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
              />
              <button
                onClick={handleEnviarNota}
                disabled={loadingEnvioNota}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
              >
                {loadingEnvioNota ? <Loader2 className="animate-spin" size={16} /> : "Enviar"}
              </button>
            </div>
          </div>
        </div>, document.body)
      )}

    </div>
  );
}
