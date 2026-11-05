"use client";

import { useState, useEffect, useRef } from "react";
import { 
  CalendarDays, 
  FileText, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Search,
  LayoutList,
  AlertCircle,
  Loader2,
  ArrowRightLeft,
  Gavel,
  Building2,
  Check,
  User,
  Upload,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSessaoDetalhes,
  adicionarItemPauta,
  adicionarItemPautaManual,
  removerItemPauta,
  type AdicionarItemPautaManualOpts,
} from "../sessoes/actions";
import { isProposicaoPautaManual } from "@/lib/pauta/pauta-manual";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { formatSessaoLegenda } from "@/lib/sessao-display";
import { rotuloAutoriaProposicao } from "@/lib/proposicao-autoria";
import { formatProposicaoTipoLabel } from "@/lib/proposicao-tipo-map";
import {
  PROPOSICAO_ARQUIVO_ACCEPT,
  isProposicaoArquivoPdf,
  validateProposicaoArquivo,
} from "@/lib/proposicao-arquivo";
import { uploadProposicaoPdf } from "@/lib/proposicao-upload-client";
import { extrairHtmlDeDocx } from "@/lib/proposicao-docx-client";
import { extrairTextoDePdf } from "@/lib/proposicao-pdf-client";

export function PautasClient({ 
  initialSessoes, 
  proposicoesProntas,
  vereadores,
  tipos,
  user,
}: { 
  initialSessoes: any[], 
  proposicoesProntas: any[],
  vereadores: any[],
  tipos: { id: string; nome: string; sigla: string }[],
  user: any,
}) {
  const [sessoes] = useState(initialSessoes);
  const [selectedSessaoId, setSelectedSessaoId] = useState<string>("");
  const [sessaoDetalhes, setSessaoDetalhes] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [manualTitulo, setManualTitulo] = useState("");
  const [manualTipoId, setManualTipoId] = useState("");
  const [manualComplemento, setManualComplemento] = useState("");
  const [manualAutoriaExecutivo, setManualAutoriaExecutivo] = useState(false);
  const [manualAutorId, setManualAutorId] = useState("");
  const [manualArquivo, setManualArquivo] = useState<File | null>(null);
  const [manualArquivoNome, setManualArquivoNome] = useState("");
  const [isProcessingManualArquivo, setIsProcessingManualArquivo] = useState(false);
  const manualArquivoInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  useEffect(() => {
    if (manualTipoId || tipos.length === 0) return;
    const padrao =
      tipos.find((t) => t.sigla === "IND") ??
      tipos.find((t) => t.nome === "Indicação") ??
      tipos[0];
    if (padrao) setManualTipoId(padrao.id);
  }, [tipos, manualTipoId]);

  const role = user?.profile?.role ?? "";
  const currentVereador = vereadores.find((v: any) => v.id === user?.profile?.vereador_id);
  const isPresidente = currentVereador?.cargo_mesa === "PRESIDENTE";
  const isVereador = role === "VEREADOR";
  const autorFormOk =
    isVereador || manualAutoriaExecutivo || manualAutorId.trim().length > 0;

  const formatarDataSessao = (data: string | Date) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(data));

  useEffect(() => {
    if (selectedSessaoId) {
      loadDetalhes();
    }
  }, [selectedSessaoId]);

  const loadDetalhes = async () => {
    setLoadingDetalhes(true);
    try {
      const data = await getSessaoDetalhes(selectedSessaoId);
      setSessaoDetalhes(data);
    } catch (e) {
      toast.error("Erro ao carregar detalhes da sessão.");
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const handleAddItem = async (propId: string) => {
    if (!selectedSessaoId) return;
    setLoading(true);
    try {
      const proximaOrdem = (sessaoDetalhes?.pauta?.length || 0) + 1;
      await adicionarItemPauta(selectedSessaoId, propId, proximaOrdem);
      toast.success("Item adicionado à pauta!");
      await loadDetalhes();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar item.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualArquivo = async (file: File | null) => {
    if (!file) {
      setManualArquivo(null);
      setManualArquivoNome("");
      return;
    }
    setIsProcessingManualArquivo(true);
    try {
      validateProposicaoArquivo(file);
      setManualArquivo(file);
      setManualArquivoNome(file.name);
      if (isProposicaoArquivoPdf(file)) {
        const texto = await extrairTextoDePdf(file);
        setManualComplemento(texto.slice(0, 8000));
        toast.success("Texto extraído do PDF preenchido nas observações.");
      } else {
        const html = await extrairHtmlDeDocx(file);
        const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (texto) {
          setManualComplemento((prev) => (prev.trim() ? prev : texto.slice(0, 8000)));
          toast.success("Texto extraído do DOCX para observações.");
        }
      }
    } catch (e: unknown) {
      setManualArquivo(null);
      setManualArquivoNome("");
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o ficheiro.");
    } finally {
      setIsProcessingManualArquivo(false);
    }
  };

  const handleAddManual = async () => {
    if (!selectedSessaoId) return;
    const titulo = manualTitulo.trim();
    if (titulo.length < 4) {
      toast.error("Informe um título com pelo menos 4 caracteres.");
      return;
    }
    setLoading(true);
    try {
      if (!manualTipoId) {
        toast.error("Selecione o tipo de matéria.");
        return;
      }
      const opts: AdicionarItemPautaManualOpts = {
        tipo_id: manualTipoId,
        autoria_poder_executivo: isVereador
          ? isPresidente && manualAutoriaExecutivo
          : manualAutoriaExecutivo,
        autor_id:
          !isVereador && !manualAutoriaExecutivo ? manualAutorId.trim() || null : undefined,
      };
      const result = await adicionarItemPautaManual(
        selectedSessaoId,
        titulo,
        manualComplemento.trim() || undefined,
        opts,
      );
      const propId = result?.proposicaoId;
      if (propId && manualArquivo && isProposicaoArquivoPdf(manualArquivo)) {
        await uploadProposicaoPdf(propId, manualArquivo, manualArquivo.name, {
          anexoPautaManual: true,
        });
        toast.success("Matéria manual inserida na pauta com PDF anexado.");
      } else {
        toast.success(
          manualArquivo && !isProposicaoArquivoPdf(manualArquivo)
            ? "Matéria manual inserida (texto do DOCX nas observações)."
            : "Matéria manual inserida na pauta.",
        );
      }
      setManualTitulo("");
      setManualComplemento("");
      setManualAutoriaExecutivo(false);
      setManualAutorId("");
      setManualArquivo(null);
      setManualArquivoNome("");
      await loadDetalhes();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao inserir matéria manual.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string, propId: string) => {
    setLoading(true);
    try {
      await removerItemPauta(itemId, propId);
      toast.success("Item removido da pauta.");
      await loadDetalhes();
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover item.");
    } finally {
      setLoading(false);
    }
  };

  const filteredProntas = proposicoesProntas.filter(p => 
    !sessaoDetalhes?.pauta?.some((item: any) => item.proposicao_id === p.id) &&
    (p.ementa.toLowerCase().includes(searchTerm.toLowerCase()) ||
     `${p.tipo} ${p.numero}/${p.ano}`.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter leading-none">Gestão de Pautas</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 text-sm uppercase tracking-widest">Organização da Ordem do Dia</p>
        </div>

        <div className="max-w-xs w-full">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Selecione a Sessão</label>
          <select 
            className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
            value={selectedSessaoId}
            onChange={(e) => setSelectedSessaoId(e.target.value)}
          >
            <option value="">Escolha uma sessão...</option>
            {sessoes.map((s: any) => (
              <option key={s.id} value={s.id} className="bg-panel text-foreground">
                {formatSessaoLegenda(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="premium-panel rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              Inserção manual na pauta
            </h2>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">
              Para assuntos que não passaram pelo protocolo/tramitação (comunicados, leituras, encaminhamentos). Pode
              anexar <strong className="text-foreground">PDF ou DOCX</strong> para organizar o expediente. A matéria
              entra na ordem do dia e pode ser <strong className="text-foreground">discutida</strong> ou{" "}
              <strong className="text-foreground">votada</strong> no painel como as demais.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Título na pauta (ementa)</label>
            <input
              type="text"
              className="premium-input rounded-lg py-2.5 px-3 text-sm shadow-sm"
              placeholder="Ex.: Comunicado da mesa diretora, leitura de ata…"
              value={manualTitulo}
              onChange={(e) => setManualTitulo(e.target.value)}
              disabled={!selectedSessaoId || loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo de matéria</label>
            <select
              value={manualTipoId}
              onChange={(e) => setManualTipoId(e.target.value)}
              disabled={!selectedSessaoId || loading || tipos.length === 0}
              className="premium-input rounded-lg py-2.5 px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              <option value="">Selecione o tipo...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {`${t.nome} (${t.sigla})`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Autoria principal</label>
            {isVereador ? (
              <div className="flex flex-col gap-2">
                {isPresidente ? (
                  <button
                    type="button"
                    onClick={() =>
                      setManualAutoriaExecutivo((prev) => {
                        const next = !prev;
                        if (next) setManualAutorId("");
                        return next;
                      })
                    }
                    disabled={!selectedSessaoId || loading}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-40",
                      manualAutoriaExecutivo
                        ? "border-amber-500/50 bg-amber-500/15"
                        : "border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/10",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                        manualAutoriaExecutivo
                          ? "border-amber-600 bg-amber-600"
                          : "border-slate-300 bg-white/80 dark:border-white/15 dark:bg-white/5",
                      )}
                    >
                      {manualAutoriaExecutivo ? (
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                      ) : null}
                    </div>
                    <Building2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Autoria do Poder Executivo (Prefeitura)
                    </span>
                  </button>
                ) : null}
                <div className="flex items-center gap-3 rounded-lg border border-border bg-panel/40 px-3 py-2.5 text-sm">
                  <User className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
                  <span className="font-bold text-foreground">
                    {manualAutoriaExecutivo && isPresidente
                      ? "Poder Executivo"
                      : currentVereador?.nome_parlamentar ?? "Vereador"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setManualAutoriaExecutivo((prev) => {
                      const next = !prev;
                      if (next) setManualAutorId("");
                      return next;
                    })
                  }
                  disabled={!selectedSessaoId || loading}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-40",
                    manualAutoriaExecutivo
                      ? "border-amber-500/50 bg-amber-500/15"
                      : "border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/10",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                      manualAutoriaExecutivo
                        ? "border-amber-600 bg-amber-600"
                        : "border-slate-300 bg-white/80 dark:border-white/15 dark:bg-white/5",
                    )}
                  >
                    {manualAutoriaExecutivo ? (
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                    ) : null}
                  </div>
                  <Building2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Autoria do Poder Executivo (Prefeitura)
                  </span>
                </button>
                <select
                  value={manualAutorId}
                  disabled={!selectedSessaoId || loading || manualAutoriaExecutivo}
                  onChange={(e) => setManualAutorId(e.target.value)}
                  className="premium-input rounded-lg py-2.5 px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <option value="">Selecione o Autor</option>
                  {vereadores
                    .filter((v: any) => v.status_mandato !== false)
                    .map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.nome_parlamentar}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Documento anexo (opcional)
            </label>
            <p className="text-[10px] font-medium text-slate-500">
              PDF ou DOCX: o texto do ficheiro é lido e preenchido automaticamente nas observações abaixo (pode editar).
            </p>
            <input
              ref={manualArquivoInputRef}
              type="file"
              accept={PROPOSICAO_ARQUIVO_ACCEPT}
              className="sr-only"
              disabled={!selectedSessaoId || loading || isProcessingManualArquivo}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void handleManualArquivo(f);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                !isProcessingManualArquivo && !loading && manualArquivoInputRef.current?.click()
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  manualArquivoInputRef.current?.click();
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 transition-colors",
                isProcessingManualArquivo
                  ? "border-amber-500/30 bg-amber-500/5 opacity-70"
                  : "border-amber-500/35 bg-white/[0.03] hover:border-amber-400/50 hover:bg-amber-500/[0.06]",
              )}
            >
              {isProcessingManualArquivo ? (
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" aria-hidden />
              ) : (
                <Upload className="h-8 w-8 text-amber-500/80" aria-hidden />
              )}
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                Clique para anexar PDF ou DOCX
              </p>
              {manualArquivoNome ? (
                <p className="max-w-full truncate px-2 text-center text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  {manualArquivoNome}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Texto ou observações (opcional)
            </label>
            <textarea
              className="premium-input min-h-[88px] resize-y rounded-lg py-2.5 px-3 text-sm shadow-sm"
              placeholder="Preenchido automaticamente ao anexar PDF/DOCX, ou digite observações…"
              value={manualComplemento}
              onChange={(e) => setManualComplemento(e.target.value)}
              disabled={!selectedSessaoId || loading}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddManual}
            disabled={loading || !selectedSessaoId || manualTitulo.trim().length < 4 || !manualTipoId || !autorFormOk}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-amber-600/20 transition hover:bg-amber-500 disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : <Plus className="h-4 w-4 shrink-0" aria-hidden />}
            Inserir na ordem do dia
          </button>
          {!selectedSessaoId ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selecione uma sessão acima.</span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden min-h-0">
        {/* Esquerda: Proposições Prontas */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black text-foreground uppercase tracking-tighter flex items-center gap-2">
              <Gavel size={20} className="text-blue-500" /> Disponíveis
            </h2>
            <div className="relative group max-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
              <input 
                type="text" 
                placeholder="Filtrar..."
                className="w-full premium-input rounded-lg py-2.5 pl-10 pr-4 text-xs shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {filteredProntas.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-border rounded-xl text-center opacity-40">
                <FileText size={48} className="mx-auto mb-2 text-slate-400" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sem projetos prontos para pauta</p>
              </div>
            ) : (
              filteredProntas.map((p) => (
                <div key={p.id} className="p-4 premium-panel rounded-lg hover:border-blue-500/30 transition-all group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">
                        {p.tipo.replace(/_/g, ' ')} {p.numero}/{p.ano}
                      </span>
                      <p className="text-foreground text-xs font-bold leading-snug line-clamp-2">{p.ementa}</p>
                      <span className="text-[9px] text-slate-500 font-bold uppercase mt-2 block">{p.autor?.nome_parlamentar}</span>
                    </div>
                    <button 
                      onClick={() => handleAddItem(p.id)}
                      disabled={loading || !selectedSessaoId}
                      className="p-3 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl transition-all disabled:opacity-30"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Direita: Pauta da Sessão */}
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          <h2 className="text-lg font-black text-foreground uppercase tracking-tighter flex items-center gap-2 mb-2">
            <LayoutList size={20} className="text-emerald-500" /> Ordem do Dia
          </h2>

          <div className="flex-1 premium-panel rounded-xl p-8 flex flex-col overflow-hidden">
            {!selectedSessaoId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                <CalendarDays size={80} className="mb-4 text-slate-400" />
                <p className="text-xl font-black uppercase tracking-tighter text-slate-500">Selecione uma Sessão Legislativa</p>
                <p className="text-sm mt-2 text-slate-400">Escolha uma sessão no menu superior para gerenciar sua pauta.</p>
              </div>
            ) : loadingDetalhes ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
              </div>
            ) : !sessaoDetalhes ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                  Carregando dados da sessão...
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {sessaoDetalhes?.pauta?.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-20 opacity-40 border-2 border-dashed border-border rounded-xl">
                    <ArrowRightLeft size={48} className="mx-auto mb-4 text-slate-400" />
                    <p className="text-sm font-black uppercase text-slate-500">Pauta Vazia</p>
                    <p className="text-xs mt-1 text-slate-400">Use projetos à esquerda ou a inserção manual acima.</p>
                  </div>
                ) : (
                  (sessaoDetalhes?.pauta || []).map((item: any, index: number) => {
                    const manual = isProposicaoPautaManual(item.proposicao?.texto_completo);
                    const rotuloTipo = manual
                      ? formatProposicaoTipoLabel(item.proposicao?.tipo)
                      : `${formatProposicaoTipoLabel(item.proposicao.tipo)} ${item.proposicao.numero != null ? `${item.proposicao.numero}/` : ""}${item.proposicao.ano}`;
                    const rotuloAutor = rotuloAutoriaProposicao(item.proposicao);
                    return (
                    <div key={item.id} className="flex items-center gap-4 group">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 border border-border">
                        {index + 1}
                      </div>
                      <div className="flex-1 p-5 premium-panel rounded-lg flex items-center justify-between group-hover:border-emerald-500/30 transition-all">
                        <div className="flex-1 pr-4">
                           <div className="flex flex-wrap items-center gap-2 mb-1">
                             {manual ? (
                               <span className="rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200">
                                 Manual
                               </span>
                             ) : null}
                             <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                               {rotuloTipo}
                             </span>
                             <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-white/10" />
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                               {rotuloAutor}
                             </span>
                           </div>
                           <p className="text-foreground text-sm font-bold leading-snug line-clamp-2">{item.proposicao.ementa}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {item.proposicao?.pdf_url ? (
                            <a
                              href={item.proposicao.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                              title="Abrir PDF anexado"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                              PDF
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id, item.proposicao_id)}
                            disabled={loading}
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            )}
            
            {selectedSessaoId && sessaoDetalhes?.pauta?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><FileText size={12} /> {sessaoDetalhes.pauta.length} itens</span>
                  <span className="flex items-center gap-1"><AlertCircle size={12} /> Ordem Sequencial Fixada</span>
                </div>
                <p>Status: {sessaoDetalhes.sessao?.status}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
