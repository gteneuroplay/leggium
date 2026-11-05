"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { 
  FileText, Plus, Search, Edit2, Trash2, 
  Calendar, User, Tag, Info, CheckCircle2, Clock, AlertCircle,
  Sparkles, Wand2, Loader2, RefreshCw, Users, X, Check, Bot, ChevronRight,
  Download,
  Building2,
  Upload,
  FileUp,
  PenLine,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import {
  upsertProposicao,
  deleteProposicao,
  getProposicaoParaPreview,
  getTramitacoes,
  registrarTramitacao,
  getPareceres,
  registrarParecer,
  getComissoes,
} from "./actions";
import { gerarEsboçoProposicao, refinarTextoLegislativo } from "./ai-actions";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { rotuloAutoriaProposicao } from "@/lib/proposicao-autoria";
import {
  PROPOSICAO_ARQUIVO_ACCEPT,
  corpoTextoDocumentoImportado,
  proposicaoTextoParaHtml,
  proposicaoDeveExibirPdfAnexado,
  proposicaoTemPdfImportado,
  textoCompletoDocumentoImportado,
  textoEhDocumentoImportado,
  validateProposicaoArquivo,
  isProposicaoArquivoPdf,
} from "@/lib/proposicao-arquivo";
import { uploadProposicaoPdf } from "@/lib/proposicao-upload-client";
import { extrairHtmlDeDocx } from "@/lib/proposicao-docx-client";
import { extrairTextoDePdf } from "@/lib/proposicao-pdf-client";
import { proposicaoTipoEnumFromNome } from "@/lib/proposicao-tipo-map";
import { isProposicaoPautaManual } from "@/lib/pauta/pauta-manual";

type OrigemDocumentoProposicao = "arquivo" | "editor";

const PdfViewer = dynamic(() => import("../tramitacao/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-blue-400">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="text-xs font-bold uppercase tracking-widest">A carregar PDF...</span>
    </div>
  ),
});

const STATUS_CONFIG: any = {
  'PROTOCOLADO': { label: 'Protocolado', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: Clock },
  'EM_TRAMITACAO': { label: 'Em tramitação', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', icon: Info },
  'AGUARDANDO_PARECER': { label: 'Aguardando parecer', color: 'text-amber-300', bg: 'bg-amber-300/10', border: 'border-amber-300/20', icon: Info },
  'PRONTO_PARA_PAUTA': { label: 'Pronto para pauta', color: 'text-purple-300', bg: 'bg-purple-300/10', border: 'border-purple-300/20', icon: Calendar },
  'EM_PAUTA': { label: 'Em pauta', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', icon: Calendar },
  'APROVADO': { label: 'Aprovado', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', icon: CheckCircle2 },
  'REJEITADO': { label: 'Rejeitado', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', icon: AlertCircle },
  'ARQUIVADO': { label: 'Arquivado', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20', icon: AlertCircle },
};

const STATUS_FILTERS = [
  { id: "TODOS", label: "Todos" },
  { id: "PROTOCOLADO", label: "Protocolado" },
  { id: "TRAMITANDO", label: "Tramitando" },
  { id: "PAUTA", label: "Pauta" },
  { id: "APROVADO", label: "Aprovado" },
  { id: "REJEITADO", label: "Rejeitado" },
] as const;

export function ProposicoesClient({ 
  initialData, 
  tipos, 
  vereadores,
  user,
  tenant
}: { 
  initialData: any[], 
  tipos: any[], 
  vereadores: any[],
  user: any,
  tenant: any
}) {
  const preencherNumeracaoNoTexto = (texto: string | undefined, proposicao: any) => {
    if (!texto) return "";
    const numero = proposicao?.numero;
    const ano = proposicao?.ano;
    if (!numero || !ano) return texto;

    // Preenche padrões como: "Nº ____/2026", "N° ____ / 2026", etc.
    const withNumeroAno = texto.replace(
      /(N[º°]\s*)_{2,}(\s*\/\s*\d{4})?/gi,
      `Nº ${numero}/${ano}`
    );

    return withNumeroAno;
  };
  const [proposicoes, setProposicoes] = useState<any[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProposicao, setSelectedProposicao] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [origemDocumento, setOrigemDocumento] = useState<OrigemDocumentoProposicao>("arquivo");
  const [arquivoProjeto, setArquivoProjeto] = useState<File | null>(null);
  const [arquivoProjetoNome, setArquivoProjetoNome] = useState("");
  const [isProcessingArquivo, setIsProcessingArquivo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const arquivoInputRef = useRef<HTMLInputElement>(null);

  const currentVereador = vereadores.find(v => v.id === user?.profile?.vereador_id);
  const isPresidente = currentVereador?.cargo_mesa === 'PRESIDENTE';
  const setorNomeNormalizado = (user?.profile?.setor?.nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const isJuridico = user?.profile?.role === "JURIDICO" || setorNomeNormalizado === "JURIDICO";

  const [formData, setFormData] = useState({
    tipo_id: "",
    ementa: "",
    texto_integral: "",
    autor_id: "",
    status: "PROTOCOLADO",
    autoria_mesa: false,
    autoria_poder_executivo: false,
  });

  const [selectedColabs, setSelectedColabs] = useState<string[]>([]);
  const [colabSearch, setColabSearch] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'tramitacao' | 'pareceres'>('geral');
  const [tramitacoes, setTramitacoes] = useState<any[]>([]);
  const [pareceres, setPareceres] = useState<any[]>([]);
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  // Estados para novos registros
  const [newTramite, setNewTramite] = useState({ acao: 'ENCAMINHADO', despacho: '' });
  const [newParecer, setNewParecer] = useState({ tipo: 'JURIDICO', comissao_id: '', texto: '', conclusao: 'FAVORAVEL' });

  const filteredData = proposicoes.filter((p) => {
    const search = searchTerm.toLowerCase().trim();
    const tipoSearch = String(
      typeof p.tipo === "string" ? p.tipo : (p.tipo?.nome ?? ""),
    ).toLowerCase();
    const matchesSearch =
      !search ||
      p.ementa.toLowerCase().includes(search) ||
      p.numero?.toString().includes(search) ||
      tipoSearch.includes(search);

    const statusAtual = String(p.status ?? "").toUpperCase();
    const matchesStatus =
      statusFilter === "TODOS" ||
      (statusFilter === "PROTOCOLADO" && statusAtual === "PROTOCOLADO") ||
      (statusFilter === "TRAMITANDO" && ["EM_TRAMITACAO", "AGUARDANDO_PARECER"].includes(statusAtual)) ||
      (statusFilter === "PAUTA" && ["PRONTO_PARA_PAUTA", "EM_PAUTA"].includes(statusAtual)) ||
      (statusFilter === "APROVADO" && statusAtual === "APROVADO") ||
      (statusFilter === "REJEITADO" && statusAtual === "REJEITADO");

    return matchesSearch && matchesStatus;
  });
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const handleOpenModal = (prop?: any) => {
    if (prop) {
      setSelectedProposicao(prop);
      setEditingId(prop.id);
      setFormData({
        tipo_id: prop.tipo_id || "",
        ementa: prop.ementa,
        texto_integral: textoEhDocumentoImportado(prop.texto_completo)
          ? corpoTextoDocumentoImportado(prop.texto_completo)
          : prop.texto_completo || "",
        autor_id: prop.autor_id || "",
        status: prop.status,
        autoria_mesa: prop.autoria_mesa || false,
        autoria_poder_executivo: prop.autoria_poder_executivo || false,
      });
      setSelectedColabs([]); 
    } else {
      setSelectedProposicao(null);
      setEditingId(null);
      setFormData({
        tipo_id: "",
        ementa: "",
        texto_integral: "",
        autor_id: user?.profile?.vereador_id || "",
        status: "PROTOCOLADO",
        autoria_mesa: false,
        autoria_poder_executivo: false,
      });
      setSelectedColabs([]);
    }
    setAiPrompt("");
    setShowAiAssistant(false);
    setArquivoProjeto(null);
    setArquivoProjetoNome("");
    if (prop) {
      const usaEditor =
        prop.texto_completo &&
        !textoEhDocumentoImportado(prop.texto_completo) &&
        !String(prop.texto_completo).trim().startsWith("<");
      setOrigemDocumento(usaEditor ? "editor" : "arquivo");
    } else {
      setOrigemDocumento("arquivo");
    }
    setActiveTab('geral');
    setIsModalOpen(true);

    if (prop) {
      loadHistory(prop.id);
    }
  };

  const handleArquivoProjeto = async (file: File | null) => {
    if (!file) {
      setArquivoProjeto(null);
      setArquivoProjetoNome("");
      return;
    }
    setIsProcessingArquivo(true);
    try {
      validateProposicaoArquivo(file);
      setArquivoProjeto(file);
      setArquivoProjetoNome(file.name);
      if (isProposicaoArquivoPdf(file)) {
        const texto = await extrairTextoDePdf(file);
        setFormData((f) => ({ ...f, texto_integral: texto }));
        toast.success("Texto extraído do PDF. Revise o campo abaixo e a ementa.");
      } else {
        const html = await extrairHtmlDeDocx(file);
        setFormData((f) => ({ ...f, texto_integral: html }));
        toast.success("Texto extraído do DOCX. Revise a ementa e protocolar.");
      }
    } catch (e: unknown) {
      setArquivoProjeto(null);
      setArquivoProjetoNome("");
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o ficheiro.");
    } finally {
      setIsProcessingArquivo(false);
    }
  };

  const loadHistory = async (id: string) => {
    setIsLoadingHistory(true);
    try {
      const [t, p, c] = await Promise.all([
        getTramitacoes(id),
        getPareceres(id),
        getComissoes()
      ]);
      setTramitacoes(t);
      setPareceres(p);
      setComissoes(c);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAddTramite = async () => {
    if (!editingId) return;
    try {
      await registrarTramitacao({
        proposicao_id: editingId,
        acao: newTramite.acao,
        despacho_texto: newTramite.despacho
      });
      toast.success("Tramitação registrada!");
      setNewTramite({ acao: 'ENCAMINHADO', despacho: '' });
      loadHistory(editingId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddParecer = async () => {
    if (!editingId) return;
    try {
      await registrarParecer({
        proposicao_id: editingId,
        tipo_parecer: isJuridico ? "JURIDICO" : newParecer.tipo,
        comissao_id: newParecer.comissao_id || null,
        texto_parecer: newParecer.texto,
        conclusao: newParecer.conclusao
      });
      toast.success("Parecer registrado!");
      setNewParecer({ tipo: 'JURIDICO', comissao_id: '', texto: '', conclusao: 'FAVORAVEL' });
      loadHistory(editingId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleGeneratePDF = async (propOverride?: any, explicitId?: string) => {
    const targetProp = propOverride || selectedProposicao;
    const finalId = explicitId || targetProp?.id || targetProp?._id;

    if (!targetProp) {
      toast.error("Nenhuma proposição selecionada para gerar PDF.");
      return;
    }

    if (
      proposicaoTemPdfImportado(targetProp) ||
      isProposicaoPautaManual(targetProp?.texto_completo)
    ) {
      toast.error(
        "Esta matéria usa um PDF anexado ou é de pauta manual. Substitua o ficheiro na edição em vez de gerar PDF pelo sistema.",
      );
      return;
    }

    if (!finalId) {
      console.error("ID ausente no targetProp:", targetProp);
      toast.error("ID da proposição não encontrado. Não é possível salvar o PDF.");
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const element = document.getElementById("document-to-print");
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Remove todas as tags de estilo que podem conter oklch/lab
          const styles = clonedDoc.getElementsByTagName("style");
          for (let i = styles.length - 1; i >= 0; i--) {
            const s = styles[i];
            if (s.textContent?.includes("oklch") || s.textContent?.includes("lab")) {
              s.remove();
            }
          }

          const el = clonedDoc.getElementById("document-to-print");
          if (el) {
            // Estilo de Reset Total para evitar cores 'lab'/'oklch'
            el.style.backgroundColor = "#ffffff";
            el.style.color = "#000000";
            el.style.padding = "20mm";
            el.style.fontFamily = "serif";

            // Limpa recursivamente todos os elementos internos
            const all = el.getElementsByTagName("*");
            for (let i = 0; i < all.length; i++) {
              const item = all[i] as HTMLElement;
              item.style.color = "#000000";
              if (item.classList.contains("rounded-full")) {
                item.style.backgroundColor = "#f1f5f9";
              }
            }
          }
        }
      });
      
      // JPEG reduz bastante o tamanho do PDF (menos risco de 413 no Nginx / corpo HTTP).
      const imgData = canvas.toDataURL("image/jpeg", 0.86);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      // Adiciona a primeira página
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      // Se ainda sobrar conteúdo, cria novas páginas e desloca a imagem para cima
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output("blob");
      try {
        await uploadProposicaoPdf(finalId, pdfBlob, "proposicao.pdf");

        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string) || "";
          setSelectedProposicao({ ...targetProp, pdf_url: base64data });
          setProposicoes((prev: any[]) =>
            prev.map((p) => (p.id === finalId ? { ...p, pdf_url: base64data } : p)),
          );
        };

        toast.success("Documento protocolado e PDF oficial gerado com sucesso!", {
          duration: 5000,
          icon: "✅",
          style: {
            borderRadius: "16px",
            background: "#10b981",
            color: "#fff",
            fontWeight: "bold",
          },
        });
      } catch (error: unknown) {
        console.error("Erro ao salvar PDF no banco:", error);
        toast.error(
          "Erro ao salvar documento: " + (error instanceof Error ? error.message : String(error)),
        );
      }
      
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      setAlertModal({
        title: "Erro ao gerar PDF",
        message: error.message || "Não foi possível gerar o documento.",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleOpenPreview = async (proposicao: any) => {
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);
    setSelectedProposicao(proposicao);
    try {
      const doc = await getProposicaoParaPreview(proposicao.id);
      const tipoNome =
        typeof proposicao.tipo === "object" && proposicao.tipo?.nome
          ? proposicao.tipo.nome
          : tipos.find((t) => proposicaoTipoEnumFromNome(t.nome) === doc.tipo)?.nome ??
            String(doc.tipo ?? "").replace(/_/g, " ");

      const merged = {
        ...proposicao,
        ...doc,
        tipo: { nome: tipoNome },
      };

      setSelectedProposicao(merged);
      setProposicoes((prev) =>
        prev.map((p) =>
          p.id === proposicao.id
            ? {
                ...p,
                pdf_url: doc.pdf_url ?? p.pdf_url,
                texto_completo: doc.texto_completo ?? p.texto_completo,
              }
            : p,
        ),
      );
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível carregar o documento para pré-visualização.",
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const modoArquivo = origemDocumento === "arquivo";
    if (modoArquivo && !editingId && !arquivoProjeto) {
      toast.error("Selecione o PDF ou DOCX do projeto.");
      return;
    }
    if (!modoArquivo && !formData.texto_integral.trim()) {
      toast.error("Informe o texto integral do projeto ou envie um ficheiro PDF/DOCX.");
      return;
    }

    const enviouPdf =
      modoArquivo && !!arquivoProjeto && isProposicaoArquivoPdf(arquivoProjeto);
    const jaEraPdfImportado =
      !!editingId && modoArquivo && textoEhDocumentoImportado(selectedProposicao?.texto_completo);
    const isPdfImport = enviouPdf || jaEraPdfImportado;

    const textoParaSalvar = isPdfImport
      ? textoCompletoDocumentoImportado(formData.texto_integral)
      : formData.texto_integral.trim();

    if (!textoParaSalvar) {
      toast.error("Não há conteúdo para protocolar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await upsertProposicao({
        ...formData,
        texto_integral: textoParaSalvar,
        id: editingId,
        colaboradores: selectedColabs,
      });

      if (!result || !result.id) {
        throw new Error("Erro ao salvar: O servidor não retornou os dados da proposição.");
      }

      const proposicaoParaPdf = {
        ...result,
        texto_completo: textoParaSalvar,
        tipo: tipos.find((t) => t.id === (result as any).tipo_id),
        autor: vereadores.find((v) => v.id === (result as any).autor_id),
        colaboradores: vereadores
          .filter((v) => selectedColabs.includes(v.id))
          .map((v) => ({ vereador: v })),
      };

      setSelectedProposicao(proposicaoParaPdf);

      setProposicoes((prev: any[]) => {
        const exists = prev.find((p) => p.id === result.id);
        if (exists) {
          return prev.map((p) => (p.id === result.id ? proposicaoParaPdf : p));
        }
        return [proposicaoParaPdf, ...prev];
      });

      const finalizarComPdfImportado = async () => {
        if (!arquivoProjeto || !isProposicaoArquivoPdf(arquivoProjeto)) return;
        await uploadProposicaoPdf(result.id, arquivoProjeto, arquivoProjeto.name, {
          documentoImportado: true,
        });
        const reader = new FileReader();
        reader.readAsDataURL(arquivoProjeto);
        reader.onloadend = () => {
          const base64data = (reader.result as string) || "";
          const patch = {
            pdf_url: base64data,
            texto_completo: textoParaSalvar,
          };
          setSelectedProposicao((prev: any) =>
            prev?.id === result.id ? { ...prev, ...patch } : prev,
          );
          setProposicoes((prev: any[]) =>
            prev.map((p) => (p.id === result.id ? { ...p, ...patch } : p)),
          );
        };
        toast.success("Projeto importado e PDF protocolado com sucesso!");
        setIsModalOpen(false);
      };

      if (isPdfImport && arquivoProjeto && isProposicaoArquivoPdf(arquivoProjeto)) {
        await finalizarComPdfImportado();
        setIsSubmitting(false);
        return;
      }

      setTimeout(async () => {
        try {
          await handleGeneratePDF(proposicaoParaPdf, result.id);
          if (modoArquivo && arquivoProjeto && !isProposicaoArquivoPdf(arquivoProjeto)) {
            toast.success("Projeto DOCX importado e PDF gerado para tramitação.");
          }
          setIsModalOpen(false);
        } catch {
          /* handleGeneratePDF já mostra erro */
        } finally {
          setIsSubmitting(false);
        }
      }, 500);
    } catch (error: unknown) {
      setIsSubmitting(false);
      setAlertModal({
        title: "Erro ao salvar",
        message: error instanceof Error ? error.message : "Não foi possível salvar a proposição.",
      });
    }
  };

  const toggleColab = (id: string) => {
    setSelectedColabs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    try {
      const selectedTipo = tipos.find(t => t.id === formData.tipo_id);
      const tipoNome = selectedTipo?.nome || "Proposição";
      
      const autorNome = formData.autoria_poder_executivo
        ? "Poder Executivo"
        : formData.autoria_mesa
          ? "Mesa Diretora"
          : vereadores.find((v) => v.id === formData.autor_id)?.nome_parlamentar || "Não identificado";
      
      const coautoresNomes = vereadores
        .filter(v => selectedColabs.includes(v.id))
        .map(v => v.nome_parlamentar);

      const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

      const result = await gerarEsboçoProposicao(tipoNome, aiPrompt, {
        autor: autorNome,
        coautores: coautoresNomes,
        data: dataAtual
      });
      
      setFormData({
        ...formData,
        ementa: result.ementa,
        texto_integral: result.texto_integral
      });
      setAiPrompt("");
      setShowAiAssistant(false);
    } catch (error: any) {
      setAlertModal({
        title: "Erro ao gerar esboço",
        message: error.message || "Tente novamente em instantes.",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiRefine = async () => {
    if (!formData.texto_integral) return;
    setIsAiLoading(true);
    try {
      const tipoNome = tipos.find(t => t.id === formData.tipo_id)?.nome || "Proposição";
      const refined = await refinarTextoLegislativo(formData.texto_integral, tipoNome);
      setFormData({
        ...formData,
        texto_integral: refined
      });
    } catch (error: any) {
      setAlertModal({
        title: "Erro ao refinar texto",
        message: error.message || "Não foi possível refinar o texto.",
      });
    } finally {
      setIsAiLoading(true); // Mantém um pouco mais ou reseta conforme necessidade
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-black tracking-tighter text-foreground sm:gap-4 sm:text-3xl md:text-4xl">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 shadow-lg shadow-blue-500/20 sm:p-3">
              <FileText className="h-6 w-6 text-white sm:h-8 sm:w-8" />
            </div>
            <span className="leading-tight">Sistema legislativo</span>
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Gestão inteligente de proposições e processos.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="group relative flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-lg bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-500 active:scale-[0.99] sm:w-auto sm:gap-3 sm:px-6 sm:py-4 sm:text-sm md:hover:scale-[1.02]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Plus className="h-5 w-5" />
          NOVA PROPOSIÇÃO
        </button>
      </div>

      {/* Busca */}
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-blue-500 transition-colors z-10" />
        <input 
          type="text" 
          placeholder="Buscar por ementa, número ou tipo..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full premium-input rounded-xl py-5 pl-14 pr-6 shadow-xl"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setStatusFilter(f.id);
              setCurrentPage(1);
            }}
            className={cn(
              "px-4 py-2 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all",
              statusFilter === f.id
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20"
                : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20 hover:text-slate-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Listagem */}
      <div className="flex-1 grid grid-cols-1 gap-4">
        {filteredData.length === 0 ? (
          <div className="premium-panel rounded-xl p-20 text-center border border-dashed border-border">
            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4 text-slate-600">
               <FileText className="h-10 w-10" />
            </div>
            <p className="text-slate-500 font-medium text-lg">Nenhuma proposição encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {paginatedData.map((p) => {
              const status = STATUS_CONFIG[p.status] || STATUS_CONFIG['PROTOCOLADO'];
              const StatusIcon = status.icon;
              const ultimaVotacao = Array.isArray(p.votacoes) && p.votacoes.length > 0 ? p.votacoes[0] : null;
              const votosUltima = Array.isArray(ultimaVotacao?.votos) ? ultimaVotacao.votos : [];
              const nomesSim = votosUltima
                .filter((v: any) => v.voto === "SIM")
                .map((v: any) => v.vereador?.nome_parlamentar)
                .filter(Boolean);
              const nomesNao = votosUltima
                .filter((v: any) => v.voto === "NAO")
                .map((v: any) => v.vereador?.nome_parlamentar)
                .filter(Boolean);
              const nomesAbs = votosUltima
                .filter((v: any) => v.voto === "ABSTENCAO")
                .map((v: any) => v.vereador?.nome_parlamentar)
                .filter(Boolean);

              return (
                <div
                  key={p.id}
                  className="w-full rounded-xl border border-border premium-panel p-4 transition-all hover:border-blue-500/35 shadow-sm"
                >
                  <div className="flex flex-col gap-4">
                    {/* Header: Tipo, Número e Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex h-7 items-center rounded-full bg-blue-500/10 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 border border-blue-500/20">
                          {p.tipo?.nome || 'PROPOSIÇÃO'} {p.numero}/{p.ano}
                        </span>
                        <div className={cn(
                          "flex h-7 items-center gap-2 rounded-full border px-4 text-[9px] font-black uppercase tracking-[0.15em] transition-all",
                          status.bg, status.color, status.border
                        )}>
                          <StatusIcon size={12} className="animate-pulse" />
                          {status.label}
                        </div>
                      </div>

                      {/* Ações Rápidas */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 border border-white/10 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-400"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-400 border border-white/10 transition-all hover:bg-red-600 hover:text-white hover:border-red-400"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Ementa do Projeto */}
                    <div className="space-y-3">
                      <h3 className="text-lg md:text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-50">
                        {p.ementa}
                      </h3>
                      {ultimaVotacao && (
                        <div className="rounded-xl border border-blue-500/20 bg-blue-600/5 p-3 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                              Última votação
                            </span>
                            <span
                              className={cn(
                                "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border",
                                ultimaVotacao.resultado_calculado === "APROVADO"
                                  ? "bg-emerald-600/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-600/15 text-red-400 border-red-500/30"
                              )}
                            >
                              {ultimaVotacao.resultado_calculado}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              SIM {nomesSim.length} • NÃO {nomesNao.length} • ABS {nomesAbs.length}
                            </span>
                          </div>
                          <div className="grid md:grid-cols-3 gap-1.5">
                            <div className="rounded-lg border border-emerald-500/25 bg-emerald-600/10 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">A favor</p>
                              <p className="text-[11px] text-slate-200 leading-snug mt-1">
                                {nomesSim.length > 0 ? nomesSim.join(", ") : "Nenhum"}
                              </p>
                            </div>
                            <div className="rounded-lg border border-red-500/25 bg-red-600/10 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-red-400">Contra</p>
                              <p className="text-[11px] text-slate-200 leading-snug mt-1">
                                {nomesNao.length > 0 ? nomesNao.join(", ") : "Nenhum"}
                              </p>
                            </div>
                            <div className="rounded-lg border border-amber-500/25 bg-amber-600/10 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">Abstenção</p>
                              <p className="text-[11px] text-slate-200 leading-snug mt-1">
                                {nomesAbs.length > 0 ? nomesAbs.join(", ") : "Nenhum"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer: Metadados e Link */}
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 pt-4">
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 shadow-lg">
                            <User size={18} className="text-blue-400/80" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Autor da Proposição</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {rotuloAutoriaProposicao(p)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 shadow-lg">
                            <Calendar size={18} className="text-cyan-400/80" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data do Protocolo</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {p.created_at ? format(new Date(p.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR }) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {p.pdf_url && (
                          <a
                            href={p.pdf_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg bg-emerald-600/10 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400 border border-emerald-500/20 transition-all hover:bg-emerald-600 hover:text-white hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] group/btn"
                          >
                            <Download size={14} />
                            Baixar PDF
                          </a>
                        )}
                        <button 
                          onClick={() => handleOpenPreview(p)}
                          className="flex items-center gap-2 rounded-lg bg-blue-600/10 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-blue-400 border border-blue-500/20 transition-all hover:bg-blue-600 hover:text-white hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] group/btn"
                        >
                          Ver Documento Completo
                          <ChevronRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Mostrando {(safeCurrentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(safeCurrentPage * PAGE_SIZE, filteredData.length)} de {filteredData.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 min-w-[90px] text-center">
              Página {safeCurrentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
      </div>

      {/* Modal Premium */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "EDITAR PROPOSIÇÃO" : "NOVA PROPOSIÇÃO"}
        size="xl"
      >
        <div className="flex flex-col gap-6">
          {/* Tabs Selector */}
          <div className="flex gap-2 w-fit">
            <button
              onClick={() => setActiveTab('geral')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                activeTab === 'geral'
                  ? "bg-blue-600 text-white border-blue-500"
                  : "text-slate-500 hover:text-white border-white/10 hover:border-white/20"
              )}
            >
              Informações Gerais
            </button>
            {editingId && (
              <>
                <button
                  onClick={() => setActiveTab('tramitacao')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                    activeTab === 'tramitacao'
                      ? "bg-amber-600 text-white border-amber-500"
                      : "text-slate-500 hover:text-white border-white/10 hover:border-white/20"
                  )}
                >
                  Tramitação
                </button>
                <button
                  onClick={() => setActiveTab('pareceres')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                    activeTab === 'pareceres'
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "text-slate-500 hover:text-white border-white/10 hover:border-white/20"
                  )}
                >
                  Pareceres
                </button>
              </>
            )}
          </div>

          {activeTab === 'geral' ? (
            <form onSubmit={handleSubmit} className="space-y-8 px-1">
          

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Matéria</label>
              <select
                required
                value={formData.tipo_id}
                onChange={(e) => setFormData({ ...formData, tipo_id: e.target.value })}
                className="w-full rounded-lg border-0 bg-white/5 py-4 px-4 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer hover:bg-white/[0.07]"
              >
                <option value="" disabled className="text-slate-500">Selecione o Tipo de Matéria</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome} ({t.sigla})</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Autoria Principal</label>
              {isPresidente && (
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500/10 transition-colors cursor-pointer group"
                    onClick={() =>
                      setFormData((f) => ({
                        ...f,
                        autoria_mesa: !f.autoria_mesa,
                        autoria_poder_executivo: false,
                      }))
                    }
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                        formData.autoria_mesa
                          ? "bg-indigo-500 border-indigo-500"
                          : "border-white/10 bg-white/5 group-hover:border-indigo-500/50",
                      )}
                    >
                      {formData.autoria_mesa && <Check className="h-3.5 w-3.5 text-white stroke-[4px]" />}
                    </div>
                    <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider">
                      Proposição da Mesa Diretora
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors cursor-pointer group"
                    onClick={() =>
                      setFormData((f) => {
                        const next = !f.autoria_poder_executivo;
                        return {
                          ...f,
                          autoria_poder_executivo: next,
                          autoria_mesa: false,
                          autor_id: next ? "" : f.autor_id,
                        };
                      })
                    }
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                        formData.autoria_poder_executivo
                          ? "bg-amber-500 border-amber-500"
                          : "border-white/10 bg-white/5 group-hover:border-amber-500/50",
                      )}
                    >
                      {formData.autoria_poder_executivo && (
                        <Check className="h-3.5 w-3.5 text-white stroke-[4px]" />
                      )}
                    </div>
                    <Building2 className="h-4 w-4 text-amber-400 shrink-0" aria-hidden />
                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                      Autoria do Poder Executivo
                    </span>
                  </div>
                </div>
              )}

              {user?.profile?.role === "VEREADOR" ? (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-white/5 border border-white/10 text-white opacity-90">
                  <User className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="font-bold text-sm">
                    {formData.autoria_poder_executivo
                      ? "Poder Executivo"
                      : formData.autoria_mesa
                        ? "Mesa Diretora"
                        : currentVereador?.nome_parlamentar}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors cursor-pointer group"
                    onClick={() =>
                      setFormData((f) => {
                        const next = !f.autoria_poder_executivo;
                        return {
                          ...f,
                          autoria_poder_executivo: next,
                          autoria_mesa: false,
                          autor_id: next ? "" : f.autor_id,
                        };
                      })
                    }
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                        formData.autoria_poder_executivo
                          ? "bg-amber-500 border-amber-500"
                          : "border-white/10 bg-white/5 group-hover:border-amber-500/50",
                      )}
                    >
                      {formData.autoria_poder_executivo && (
                        <Check className="h-3.5 w-3.5 text-white stroke-[4px]" />
                      )}
                    </div>
                    <Building2 className="h-4 w-4 text-amber-400 shrink-0" aria-hidden />
                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                      Autoria do Poder Executivo (Prefeitura)
                    </span>
                  </div>
                  <select
                    value={formData.autor_id}
                    disabled={formData.autoria_poder_executivo}
                    required={!formData.autoria_poder_executivo}
                    onChange={(e) => setFormData({ ...formData, autor_id: e.target.value })}
                    className="w-full rounded-lg border-0 bg-white/5 py-4 px-4 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer hover:bg-white/[0.07] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecione o Autor</option>
                    {vereadores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome_parlamentar}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Seção de Coautoria */}
          <div className="space-y-4 p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">Coautores e Colaboradores</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Selecione vereadores para assinar este projeto em conjunto.</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-1 bg-white/5 rounded-lg text-slate-400">
                {selectedColabs.length} SELECIONADOS
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input 
                type="text"
                placeholder="Buscar vereador..."
                value={colabSearch}
                onChange={(e) => setColabSearch(e.target.value)}
                className="w-full bg-white/5 border-0 rounded-lg py-3 pl-11 pr-4 text-xs text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {vereadores
                .filter(v => v.id !== user?.profile?.vereador_id)
                .filter(v => v.nome_parlamentar.toLowerCase().includes(colabSearch.toLowerCase()))
                .map(v => {
                  const isSelected = selectedColabs.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleColab(v.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border",
                        isSelected 
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {v.nome_parlamentar}
                    </button>
                  );
                })
              }
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-emerald-400" />
                  Documento do projeto
                </h3>
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  Envie o PDF ou DOCX já pronto (opção mais usada) ou digite / use a IA.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOrigemDocumento("arquivo")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border",
                    origemDocumento === "arquivo"
                      ? "border-emerald-500/60 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  PDF / DOCX
                </button>
                <button
                  type="button"
                  onClick={() => setOrigemDocumento("editor")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border",
                    origemDocumento === "editor"
                      ? "border-blue-500/60 bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10",
                  )}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Digitar / IA
                </button>
              </div>
            </div>

            {origemDocumento === "arquivo" ? (
              <div className="space-y-3">
                <input
                  ref={arquivoInputRef}
                  type="file"
                  accept={PROPOSICAO_ARQUIVO_ACCEPT}
                  className="sr-only"
                  disabled={isProcessingArquivo || isSubmitting}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    void handleArquivoProjeto(f);
                    e.target.value = "";
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !isProcessingArquivo && !isSubmitting && arquivoInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      arquivoInputRef.current?.click();
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-colors",
                    isProcessingArquivo
                      ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                      : "border-emerald-500/35 bg-white/[0.03] hover:border-emerald-400/50 hover:bg-emerald-500/[0.08]",
                  )}
                >
                  {isProcessingArquivo ? (
                    <Loader2 className="h-10 w-10 shrink-0 animate-spin text-emerald-400" />
                  ) : (
                    <Upload className="h-10 w-10 shrink-0 text-emerald-400/80" />
                  )}
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-200">
                      Clique ou arraste o ficheiro
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-500">
                      PDF (anexo direto) ou DOCX (extrai texto e gera PDF) — máx. 15 MB
                    </p>
                  </div>
                  {arquivoProjetoNome ? (
                    <p className="max-w-full truncate px-2 text-center text-[11px] font-bold text-emerald-300">
                      {arquivoProjetoNome}
                    </p>
                  ) : null}
                </div>
                {(arquivoProjeto && isProposicaoArquivoPdf(arquivoProjeto)) ||
                (editingId && textoEhDocumentoImportado(selectedProposicao?.texto_completo)) ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium leading-relaxed text-slate-400">
                      O PDF será o documento oficial. O texto abaixo foi lido do ficheiro — pode editar antes de
                      protocolar.
                    </p>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Texto extraído do PDF (referência)
                    </label>
                    <textarea
                      rows={8}
                      value={formData.texto_integral}
                      onChange={(e) => setFormData({ ...formData, texto_integral: e.target.value })}
                      disabled={isSubmitting}
                      className="w-full rounded-lg border-0 bg-white/5 py-3 px-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-emerald-500 custom-scrollbar max-h-[280px] resize-y"
                      placeholder="O conteúdo do PDF aparecerá aqui após o envio do ficheiro…"
                    />
                  </div>
                ) : null}
                {editingId && selectedProposicao?.pdf_url && !arquivoProjeto ? (
                  <a
                    href={selectedProposicao.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Ver PDF já protocolado
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Ementa (Resumo)</label>
            <textarea
              required
              rows={3}
              value={formData.ementa}
              onChange={(e) => setFormData({ ...formData, ementa: e.target.value })}
              className="w-full rounded-lg border-0 bg-white/5 py-4 px-4 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600"
              placeholder="Ex: Dispõe sobre..."
            />
          </div>

          {origemDocumento === "editor" ? (
          <>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="h-20 w-20" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  SYSLEGIS<span className="text-blue-300">IA</span>
                </h3>
                <p className="text-[10px] text-blue-100/60 font-bold uppercase tracking-wider">Inteligência Artificial de Apoio Legislativo</p>
              </div>
              
              <button
                type="button"
                onClick={() => setShowAiAssistant(!showAiAssistant)}
                disabled={!formData.tipo_id}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                  !formData.tipo_id 
                    ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                    : showAiAssistant 
                      ? "bg-white text-blue-600 hover:scale-105" 
                      : "bg-blue-500/30 text-white border border-white/20 hover:bg-blue-500/50 hover:scale-105"
                )}
              >
                {!formData.tipo_id 
                  ? "ESCOLHA O TIPO PRIMEIRO" 
                  : showAiAssistant ? "FECHAR ASSISTENTE" : "ATIVAR INTELIGÊNCIA"}
              </button>
            </div>

            {showAiAssistant && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="relative group">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Descreva sua ideia para a SysLegisIA: 'Criar dia municipal do...'"
                    className="w-full bg-white/10 border-white/20 rounded-lg py-4 pl-5 pr-32 text-sm text-white placeholder:text-blue-100/50 focus:ring-2 focus:ring-white/50 border-0 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isAiLoading || !aiPrompt}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shadow-xl"
                  >
                    {isAiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    GERAR AGORA
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Texto Integral do Projeto</label>
              <button 
                type="button" 
                onClick={handleAiRefine}
                disabled={isAiLoading || !formData.texto_integral}
                className={cn(
                  "text-[10px] font-black flex items-center gap-1.5 transition-all disabled:opacity-30",
                  isAiLoading ? "text-amber-400" : "text-blue-400 hover:text-blue-300"
                )}
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    REFINANDO TEXTO...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    REFINAR COM SYSLEGIS<span className="text-blue-400">IA</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={12}
              value={formData.texto_integral}
              onChange={(e) => setFormData({ ...formData, texto_integral: e.target.value })}
              className="w-full rounded-xl border-0 bg-white/5 py-5 px-5 text-sm text-white font-mono leading-relaxed ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 transition-all custom-scrollbar placeholder:text-slate-700"
            />
          </div>
          </>
          ) : null}

          <div className="mt-10 flex justify-end gap-4 pt-8 border-t border-white/5 pb-4">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-8 py-4 text-xs font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest"
            >
              CANCELAR
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || isProcessingArquivo}
              className="relative overflow-hidden px-10 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-black text-white shadow-2xl shadow-blue-600/30 transition-all hover:scale-[1.03] hover:shadow-blue-500/40 active:scale-95 group disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {isSubmitting ? "A PROTOCOLAR..." : "SALVAR E PROTOCOLAR"}
            </button>
          </div>
        </form>
          ) : activeTab === 'tramitacao' ? (
            <div className="space-y-6">
              {/* Novo Trâmite */}
              <div className="premium-panel p-6 rounded-xl border border-border space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Registrar Nova Movimentação</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select 
                    value={newTramite.acao}
                    onChange={(e) => setNewTramite({...newTramite, acao: e.target.value})}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                  >
                    <option value="ENCAMINHADO" >Encaminhar</option>
                    <option value="RECEBIDO" >Receber</option>
                    <option value="DEVOLVIDO" >Devolver</option>
                    <option value="ARQUIVADO" >Arquivar</option>
                  </select>
                  <button 
                    onClick={handleAddTramite}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase py-2 rounded-xl transition-all"
                  >
                    Registrar Movimentação
                  </button>
                </div>
                <textarea 
                  placeholder="Despacho ou observações..."
                  value={newTramite.despacho}
                  onChange={(e) => setNewTramite({...newTramite, despacho: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white h-20"
                />
              </div>

              {/* Timeline */}
              <div className="space-y-4 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-px before:bg-white/10">
                {isLoadingHistory ? (
                  <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : tramitacoes.length === 0 ? (
                  <p className="text-center text-slate-500 py-10">Nenhum histórico registrado.</p>
                ) : (
                  tramitacoes.map((t, idx) => (
                    <div key={t.id} className="relative pl-14 group">
                      <div className="absolute left-[20px] top-1 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] border-2 border-slate-950 z-10" />
                      <div className="premium-panel p-4 rounded-lg border border-border group-hover:border-amber-500/30 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{t.acao}</span>
                          <span className="text-[10px] text-slate-500 font-bold">{format(new Date(t.data_tramite), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                        <p className="text-sm text-slate-300 mb-2">{t.despacho_texto || 'Sem observações.'}</p>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                            <User size={10} className="text-slate-500" />
                          </div>
                          <span className="text-[9px] font-black text-slate-500 uppercase">{t.usuario?.nome}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Novo Parecer */}
              <div className="premium-panel p-6 rounded-xl border border-border space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Emitir Novo Parecer</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select 
                    value={isJuridico ? "JURIDICO" : newParecer.tipo}
                    onChange={(e) => setNewParecer({...newParecer, tipo: e.target.value})}
                    disabled={isJuridico}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                  >
                    <option value="JURIDICO" >Jurídico</option>
                    {!isJuridico && <option value="COMISSAO" >Comissão</option>}
                  </select>
                  
                  {!isJuridico && newParecer.tipo === 'COMISSAO' && (
                    <select 
                      value={newParecer.comissao_id}
                      onChange={(e) => setNewParecer({...newParecer, comissao_id: e.target.value})}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                    >
                      <option value="">Selecione a Comissão</option>
                      {comissoes.map(c => (
                        <option key={c.id} value={c.id}>{c.sigla} - {c.nome}</option>
                      ))}
                    </select>
                  )}

                  <select 
                    value={newParecer.conclusao}
                    onChange={(e) => setNewParecer({...newParecer, conclusao: e.target.value})}
                    className={cn(
                      "border rounded-xl px-4 py-2 text-sm font-bold uppercase",
                      newParecer.conclusao === 'FAVORAVEL' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                    )}
                  >
                    <option value="FAVORAVEL" >Favorável</option>
                    <option value="CONTRARIO" >Contrário</option>
                  </select>

                  <button 
                    onClick={handleAddParecer}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase py-2 rounded-xl transition-all shadow-lg shadow-emerald-900/20 md:col-span-full lg:col-span-1"
                  >
                    Registrar Parecer
                  </button>
                </div>
                <textarea 
                  placeholder="Texto do parecer..."
                  value={newParecer.texto}
                  onChange={(e) => setNewParecer({...newParecer, texto: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white h-24"
                />
              </div>

              {/* Lista de Pareceres */}
              <div className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : pareceres.length === 0 ? (
                  <p className="text-center text-slate-500 py-10">Nenhum parecer registrado.</p>
                ) : (
                  pareceres.map((p) => (
                    <div key={p.id} className="premium-panel p-5 rounded-lg border border-border flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter",
                            p.tipo_parecer === 'JURIDICO' ? "bg-blue-500 text-white" : "bg-purple-500 text-white"
                          )}>
                            {p.tipo_parecer} {p.comissao?.sigla}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold uppercase",
                            p.conclusao === 'FAVORAVEL' ? "text-emerald-400" : "text-red-400"
                          )}>
                            {p.conclusao}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold">{format(new Date(p.created_at), "dd/MM/yyyy")}</span>
                      </div>
                      <p className="text-sm text-slate-300 italic">"{p.texto_parecer}"</p>
                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                          <User size={12} className="text-slate-500" />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase">{p.autor?.nome}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>

      {/* Modal de Visualização de Documento */}
      <Modal 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        title="VISUALIZAÇÃO DO DOCUMENTO"
        size={proposicaoDeveExibirPdfAnexado(selectedProposicao) ? "2xl" : "xl"}
      >
        <div className="flex flex-col gap-6">
          {proposicaoDeveExibirPdfAnexado(selectedProposicao) ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[11px] font-medium text-emerald-200/90">
              {isProposicaoPautaManual(selectedProposicao?.texto_completo)
                ? "Matéria com documento anexado na pauta. A pré-visualização abaixo é o ficheiro enviado."
                : "Documento protocolado a partir do PDF enviado. A pré-visualização abaixo é o ficheiro original, não o modelo gerado pelo sistema."}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 no-print">
            {selectedProposicao?.pdf_url && (
              <a 
                href={selectedProposicao.pdf_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download size={16} />
                BAIXAR PDF OFICIAL
              </a>
            )}
            {!proposicaoDeveExibirPdfAnexado(selectedProposicao) ? (
              <button
                type="button"
                onClick={() => handleGeneratePDF()}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
              >
                {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {selectedProposicao?.pdf_url ? "ATUALIZAR PDF" : "GERAR PDF OFICIAL"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setIsPreviewOpen(false);
                handleOpenModal(selectedProposicao);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 text-slate-300 border border-white/10 rounded-xl font-bold text-xs hover:bg-white/10 transition-all"
            >
              <Edit2 size={16} />
              EDITAR DOCUMENTO
            </button>
          </div>

          {isLoadingPreview ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-blue-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">A carregar documento...</span>
            </div>
          ) : proposicaoDeveExibirPdfAnexado(selectedProposicao) ? (
            <div className="min-h-[50vh] w-full overflow-auto rounded-lg border border-white/10 bg-slate-950/40 p-2 sm:p-4">
              {selectedProposicao?.pdf_url ? (
                <PdfViewer url={selectedProposicao.pdf_url} />
              ) : (
                <p className="py-12 text-center text-sm text-slate-400">
                  PDF importado não encontrado. Tente reenviar o ficheiro na edição da proposição.
                </p>
              )}
            </div>
          ) : (
          <div
            id="document-to-print" 
            style={{ backgroundColor: '#ffffff', color: '#000000' }}
            className="bg-white text-slate-900 p-12 md:p-20 shadow-2xl rounded-sm min-h-[1123px] w-[210mm] mx-auto font-serif leading-relaxed print:shadow-none print:p-0 overflow-hidden"
          >
            {/* Cabeçalho Oficial */}
            <div className="text-center space-y-4 mb-16 pb-8" style={{ borderBottom: '2px solid #000000' }}>
              <div className="mx-auto w-24 h-24 flex items-center justify-center mb-4 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
                {tenant?.brasao_url ? (
                  <img src={tenant.brasao_url} alt="Brasão" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter" style={{ color: '#94a3b8' }}>Brasão da Câmara</span>
                )}
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">
                  {tenant?.settings?.document_header?.title || "Estado de Sergipe"}
                </h1>
                <h2 className="text-lg font-bold uppercase text-slate-800">
                  {tenant?.settings?.document_header?.subtitle || "Câmara Municipal de Aracaju"}
                </h2>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.3em]">
                  {tenant?.settings?.document_header?.description || "Palácio Legislativo Municipal"}
                </p>
              </div>
            </div>

            {/* Identificação da Proposição */}
            <div className="text-right mb-12">
              <div className="inline-block p-4 font-bold text-lg uppercase tracking-tight" style={{ border: '2px solid #000000' }}>
                {selectedProposicao?.tipo?.nome} Nº {selectedProposicao?.numero}/{selectedProposicao?.ano}
              </div>
            </div>

            {/* Ementa (Justificada à Direita) */}
            <div className="flex justify-end mb-16">
              <div className="w-1/2 text-sm italic font-bold leading-relaxed text-justify pl-6 py-2" style={{ borderLeft: '4px solid #e2e8f0' }}>
                {selectedProposicao?.ementa}
              </div>
            </div>

            {/* Corpo do Texto */}
            <div className="max-w-none mb-20 text-justify" style={{ color: '#000000' }}>
              <div 
                dangerouslySetInnerHTML={{
                  __html:
                    proposicaoTextoParaHtml(
                      preencherNumeracaoNoTexto(
                        selectedProposicao?.texto_completo,
                        selectedProposicao,
                      ),
                    ) || "",
                }} 
                className="whitespace-pre-wrap leading-[1.8] text-lg"
                style={{ color: '#000000' }}
              />
            </div>

            {/* Local e Data */}
            <div className="text-right mb-24 font-bold italic">
              Sala das Sessões, {selectedProposicao?.created_at ? format(new Date(selectedProposicao.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}.
            </div>

            {/* Assinaturas */}
            <div className="flex flex-col items-center gap-12 mt-20">
              <div className="w-64 pt-2 text-center" style={{ borderTop: "1px solid #000000" }}>
                <p className="font-black text-sm uppercase tracking-widest">
                  {rotuloAutoriaProposicao(selectedProposicao)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: "#64748b" }}>
                  {selectedProposicao?.autoria_poder_executivo
                    ? "Poder Executivo Municipal"
                    : selectedProposicao?.autoria_mesa
                      ? "Mesa Diretora"
                      : "Vereador Proponente"}
                </p>
              </div>

              {selectedProposicao?.colaboradores?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-16 mt-8">
                  {selectedProposicao.colaboradores.map((colab: any) => (
                    <div key={colab.id} className="w-48 pt-2 text-center" style={{ borderTop: '1px solid #94a3b8' }}>
                      <p className="font-bold text-xs uppercase">{colab.vereador?.nome_parlamentar}</p>
                      <p className="text-[8px] font-medium uppercase tracking-widest mt-0.5 text-nowrap" style={{ color: '#94a3b8' }}>Coautor</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
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
        title="Excluir proposição?"
        message="Esta ação remove o registro permanentemente. Confirma a exclusão?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteProposicao(deleteConfirmId);
            setProposicoes((prev) => prev.filter((p) => p.id !== deleteConfirmId));
            if (selectedProposicao?.id === deleteConfirmId) {
              setSelectedProposicao(null);
              setIsPreviewOpen(false);
            }
          } catch (error: any) {
            setAlertModal({
              title: "Erro ao excluir",
              message: error.message || "Não foi possível excluir a proposição.",
            });
          }
        }}
      />
    </div>
  );
}
