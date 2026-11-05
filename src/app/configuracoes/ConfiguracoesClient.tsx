"use client";

import { useState, useRef } from "react";
import { Building2, Save, Image as ImageIcon, Key, Wand2, Upload, FileText, Loader2 } from "lucide-react";
import { updateTenantConfig, uploadBrasao } from "./actions";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

export function ConfiguracoesClient({ initialData }: { initialData: any }) {
  const mapTipoToEnum = (nome: string) => {
    const mapTipo: Record<string, string> = {
      "Projeto de Lei": "PROJETO_DE_LEI",
      "Indicação": "INDICACAO",
      "Moção": "MOCAO",
      "Requerimento": "REQUERIMENTO",
      "Emendas": "EMENDA",
      "Ata": "ATA",
      "Parecer de Comissão": "PARECER_DE_COMISSAO",
      "Decreto": "DECRETO",
      "Mesa Diretora": "MESA_DIRETORA",
      "Resolução": "PROJETO_DE_RESOLUCAO",
      "Proposição": "PROPOSICAO",
      "Outros": "OUTROS",
    };
    return mapTipo[nome] || "PROPOSICAO";
  };

  const currentYear = new Date().getFullYear();
  const [anoNumeracao, setAnoNumeracao] = useState<number>(currentYear);
  const tipos = initialData?.tiposProposicao || [];
  const numeracaoSettings = (initialData?.settings?.proposicao_numeracao || {}) as Record<string, Record<string, number>>;

  const buildNumeracaoForYear = (year: number) => {
    const existing = numeracaoSettings[String(year)] || {};
    const data: Record<string, number> = {};
    for (const tipo of tipos) {
      const enumKey = mapTipoToEnum(tipo.nome);
      const val = Number(existing[enumKey]);
      data[enumKey] = Number.isFinite(val) && val > 0 ? Math.floor(val) : 1;
    }
    return data;
  };

  const [numeracaoPorTipo, setNumeracaoPorTipo] = useState<Record<string, number>>(
    buildNumeracaoForYear(currentYear)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    nome_camara: initialData?.nome_camara || "",
    brasao_url: initialData?.brasao_url || "",
    gemini_api_key: initialData?.gemini_api_key || "",
    settings: {
      document_header: {
        title: initialData?.settings?.document_header?.title || "ESTADO DE SERGIPE",
        subtitle: initialData?.settings?.document_header?.subtitle || "CÂMARA MUNICIPAL DE ARACAJU",
        description: initialData?.settings?.document_header?.description || "Palácio Legislativo Municipal"
      },
      oratoria_tempo: {
        orador_minutos: Number(initialData?.settings?.oratoria_tempo?.orador_minutos || 10),
        aparte_minutos: Number(initialData?.settings?.oratoria_tempo?.aparte_minutos || 3),
      },
      proposicao_numeracao: numeracaoSettings
    }
  });

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const url = await uploadBrasao(form);
      setFormData({ ...formData, brasao_url: url });
      toast.success("Brasão enviado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const nextNumeracao = {
        ...(formData.settings?.proposicao_numeracao || {}),
        [String(anoNumeracao)]: numeracaoPorTipo
      };
      await updateTenantConfig({
        ...formData,
        settings: {
          ...formData.settings,
          proposicao_numeracao: nextNumeracao
        }
      });
      toast.success("Configurações atualizadas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeAnoNumeracao = (year: number) => {
    setAnoNumeracao(year);
    const baseNumeracao = (formData.settings?.proposicao_numeracao || {}) as Record<string, Record<string, number>>;
    const existing = baseNumeracao[String(year)] || {};
    const rebuilt: Record<string, number> = {};
    for (const tipo of tipos) {
      const enumKey = mapTipoToEnum(tipo.nome);
      const val = Number(existing[enumKey]);
      rebuilt[enumKey] = Number.isFinite(val) && val > 0 ? Math.floor(val) : 1;
    }
    setNumeracaoPorTipo(rebuilt);
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-600 shadow-xl shadow-blue-600/20">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          Configurações
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] ml-1">Gerencie a identidade institucional e integrações da sua Câmara.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identidade */}
        <div className="premium-panel p-8 rounded-xl space-y-8 shadow-2xl border border-border">
          <h2 className="text-xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
            <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Identidade Institucional
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Câmara</label>
              <input
                type="text"
                required
                value={formData.nome_camara}
                onChange={(e) => setFormData({ ...formData, nome_camara: e.target.value })}
                className="w-full premium-input rounded-xl py-4 px-4 shadow-sm font-bold"
                placeholder="Ex: Câmara Municipal de Salvador"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Brasão Institucional</label>
              
              <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative h-44 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden",
                  isDragging 
                    ? "border-blue-500 bg-blue-600/10 scale-[1.02]" 
                    : "border-border bg-slate-50 dark:bg-white/5 hover:border-blue-500/50 hover:bg-slate-100 dark:hover:bg-white/10"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                {formData.brasao_url ? (
                  <div className="relative group/img w-full h-full flex items-center justify-center p-4">
                    <img src={formData.brasao_url} alt="Brasão" className="h-full w-full object-contain" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <p className="text-white text-[10px] font-black tracking-widest uppercase">Trocar Imagem</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-xl bg-white dark:bg-white/5 text-slate-400 border border-border shadow-sm">
                      <Upload className={cn("h-6 w-6 transition-transform", isDragging && "scale-125")} />
                    </div>
                    <div className="text-center">
                      <p className="text-foreground text-[10px] font-black uppercase tracking-widest">Arraste o Brasão</p>
                      <p className="text-slate-500 text-[10px] mt-1 font-bold">PNG OU SVG (TRANSPARENTE)</p>
                    </div>
                  </>
                )}
                
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Configurações do Timbre (PDF) */}
        <div className="premium-panel p-8 rounded-xl space-y-8 shadow-2xl border border-border">
          <h2 className="text-xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Timbre de Documentos (PDF)
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Título do Cabeçalho</label>
              <input
                type="text"
                required
                value={formData.settings.document_header.title}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  settings: { 
                    ...formData.settings, 
                    document_header: { ...formData.settings.document_header, title: e.target.value.toUpperCase() } 
                  } 
                })}
                className="w-full premium-input rounded-xl py-4 px-4 shadow-sm font-bold"
                placeholder="Ex: ESTADO DE SERGIPE"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Subtítulo do Cabeçalho</label>
              <input
                type="text"
                required
                value={formData.settings.document_header.subtitle}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  settings: { 
                    ...formData.settings, 
                    document_header: { ...formData.settings.document_header, subtitle: e.target.value.toUpperCase() } 
                  } 
                })}
                className="w-full premium-input rounded-xl py-4 px-4 shadow-sm font-bold"
                placeholder="Ex: CÂMARA MUNICIPAL DE ARACAJU"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descrição / Localização</label>
              <input
                type="text"
                value={formData.settings.document_header.description}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  settings: { 
                    ...formData.settings, 
                    document_header: { ...formData.settings.document_header, description: e.target.value } 
                  } 
                })}
                className="w-full premium-input rounded-xl py-4 px-4 shadow-sm font-bold"
                placeholder="Ex: Palácio Legislativo Municipal"
              />
            </div>
          </div>
        </div>

        {/* Numeração de Proposições */}
        <div className="premium-panel p-8 rounded-xl space-y-8 shadow-2xl border border-border">
          <h2 className="text-xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Numeração de Proposições
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Defina o próximo número por tipo e ano para câmaras já em funcionamento.
          </p>

          <div className="space-y-2 max-w-xs">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ano de Referência</label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={anoNumeracao}
              onChange={(e) => handleChangeAnoNumeracao(Number(e.target.value || currentYear))}
              className="w-full premium-input rounded-xl py-3 px-4 shadow-sm font-bold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tipos.map((tipo: any) => {
              const enumKey = mapTipoToEnum(tipo.nome);
              return (
                <div key={tipo.id} className="rounded-xl border border-border p-4 bg-slate-50 dark:bg-white/5 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tipo.nome}</label>
                  <input
                    type="number"
                    min={1}
                    value={numeracaoPorTipo[enumKey] || 1}
                    onChange={(e) =>
                      setNumeracaoPorTipo((prev) => ({
                        ...prev,
                        [enumKey]: Math.max(1, Number(e.target.value || 1)),
                      }))
                    }
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm font-bold"
                    placeholder="Próximo número"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Regras de Oratória */}
        <div className="premium-panel p-8 rounded-xl space-y-8 shadow-2xl border border-border">
          <h2 className="text-xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
            <Wand2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Regras de Oratória
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Defina os tempos padrão do cronômetro para discurso e aparte conforme o regimento interno.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempo do Orador (minutos)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={formData.settings.oratoria_tempo.orador_minutos}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: {
                    ...formData.settings,
                    oratoria_tempo: {
                      ...formData.settings.oratoria_tempo,
                      orador_minutos: Math.max(1, Number(e.target.value || 1)),
                    }
                  }
                })}
                className="w-full premium-input rounded-xl py-4 px-4 shadow-sm font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempo de Aparte (minutos)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={formData.settings.oratoria_tempo.aparte_minutos}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: {
                    ...formData.settings,
                    oratoria_tempo: {
                      ...formData.settings.oratoria_tempo,
                      aparte_minutos: Math.max(1, Number(e.target.value || 1)),
                    }
                  }
                })}
                className="w-full premium-input rounded-xl py-4 px-4 shadow-sm font-bold"
              />
            </div>
          </div>
        </div>

        {/* Integração de IA */}
        <div className="premium-panel p-8 rounded-xl space-y-8 shadow-2xl border border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
              <Wand2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Inteligência Artificial
            </h2>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-500/20">Google Gemini</span>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Google Gemini API Key</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-600">
                <Key className="h-5 w-5" />
              </div>
              <input
                type="password"
                value={formData.gemini_api_key}
                onChange={(e) => setFormData({ ...formData, gemini_api_key: e.target.value })}
                placeholder="AIza..."
                className="w-full premium-input rounded-xl py-4 pl-12 pr-4 shadow-sm font-bold"
              />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">Utilizada para geração de ementas, resumos e análise de proposições.</p>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-blue-600 px-12 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-blue-600/30 transition-all hover:bg-blue-500 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Save className="h-5 w-5" />
            {isLoading ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
