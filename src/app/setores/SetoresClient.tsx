"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Search, Edit2, Trash2, Building2, 
  ShieldCheck, CheckSquare, Square, ClipboardList,
  LayoutDashboard, CalendarDays, FileText, 
  Vote, Gavel, Mic2, Users, Settings, Scale, Tv, Video
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { cn } from "@/lib/utils";
import { upsertSetor, deleteSetor } from "./actions";

function normalizeSetorNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isSystemSetor(nome: string) {
  const normalized = normalizeSetorNome(nome);
  return normalized === "OPERADOR" || normalized === "ADMINISTRADOR" || normalized === "JURIDICO";
}

const ABAS_SISTEMA = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "obs", label: "OBS / Transmissão", icon: Video },
  { id: "sessoes", label: "Sessões", icon: CalendarDays },
  { id: "tramitacao", label: "Tramitação", icon: Scale },
  { id: "pautas", label: "Pautas da Sessão", icon: ClipboardList },
  { id: "proposicoes", label: "Proposições", icon: FileText },
  { id: "painel", label: "Painel de Votação", icon: Vote },
  { id: "painel_tv", label: "Painel TV", icon: Tv },
  { id: "painel_operador", label: "Painel do Operador", icon: ShieldCheck },
  { id: "painel_vereador", label: "Painel do Vereador", icon: Vote },
  { id: "bancadas", label: "Bancadas", icon: Building2 },
  { id: "vereadores", label: "Vereadores", icon: Gavel },
  { id: "comissoes", label: "Comissões", icon: ClipboardList },
  { id: "visitantes", label: "Oradores", icon: Mic2 },
  { id: "setores", label: "Setores", icon: Building2 },
  { id: "cargos", label: "Cargos", icon: ShieldCheck },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

export function SetoresClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    sigla: "",
    permissoes: {} as Record<string, boolean>,
  });

  const filteredData = initialData.filter(s => 
    s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.sigla.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (setor?: any) => {
    if (setor) {
      setEditingId(setor.id);
      setFormData({
        nome: setor.nome,
        sigla: setor.sigla,
        permissoes: setor.permissoes || {},
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: "",
        sigla: "",
        permissoes: ABAS_SISTEMA.reduce((acc, aba) => ({ ...acc, [aba.id]: false }), {}),
      });
    }
    setIsModalOpen(true);
  };

  const togglePermissao = (abaId: string) => {
    setFormData(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [abaId]: !prev.permissoes[abaId]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertSetor({ ...formData, id: editingId });
      setIsModalOpen(false);
    } catch (error) {
      setAlertModal({ title: "Erro ao salvar", message: "Não foi possível salvar o setor." });
    }
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-1 flex items-center gap-3">
            <Building2 className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            Setores e Departamentos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Configure departamentos e permissões de acesso da equipe.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 premium-transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Novo Setor
        </button>
      </div>

      {/* Busca */}
      <div className="relative group max-w-2xl w-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
        <input 
          type="text" 
          placeholder="Buscar setor por nome ou sigla..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full premium-input rounded-xl py-4 pl-14 pr-6 shadow-lg"
        />
      </div>

      {/* Listagem em Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredData.map((setor) => (
          <div key={setor.id} className="premium-panel p-8 rounded-xl border border-border hover:border-blue-500/50 premium-transition group shadow-xl hover:shadow-2xl flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-black tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>{setor.nome}</h3>
                <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{setor.sigla}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 premium-transition">
                <button 
                  onClick={() => handleOpenModal(setor)} 
                  className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-blue-600/10 rounded-xl premium-transition"
                  title="Editar"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {!isSystemSetor(setor.nome) && (
                  <button 
                    onClick={() => setDeleteConfirmId(setor.id)} 
                    className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl premium-transition"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {isSystemSetor(setor.nome) && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600/10 text-[10px] font-black text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-widest shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" /> Setor de Sistema
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-auto pt-6 border-t border-border">
              {ABAS_SISTEMA.map(aba => setor.permissoes?.[aba.id] && (
                <span key={aba.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-input-bg text-[10px] font-bold border border-border shadow-sm" style={{ color: 'var(--text-secondary)' }}>
                  <aba.icon className="h-3.5 w-3.5 text-blue-500" />
                  {aba.label}
                </span>
              ))}
              {Object.values(setor.permissoes || {}).filter(Boolean).length === 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic py-2">Sem acessos configurados</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Setor" : "Criar Novo Setor"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Sigla</label>
              <input
                type="text"
                required
                maxLength={10}
                value={formData.sigla}
                onChange={(e) => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm font-black uppercase"
                placeholder="Ex: ADM"
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Setor</label>
              <input
                type="text"
                required
                disabled={isSystemSetor(formData.nome)}
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={cn(
                  "w-full premium-input rounded-xl py-3 px-4 shadow-sm font-bold",
                  isSystemSetor(formData.nome) && "opacity-50 cursor-not-allowed grayscale"
                )}
                placeholder="Ex: Departamento Administrativo"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Permissões de Acesso
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6 bg-slate-50 dark:bg-white/5 rounded-xl border border-border max-h-[350px] overflow-y-auto custom-scrollbar">
              {ABAS_SISTEMA.map((aba) => (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => togglePermissao(aba.id)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border-2 transition-all active:scale-[0.98]",
                    formData.permissoes[aba.id] 
                    ? "bg-blue-600/10 border-blue-600/40 text-foreground shadow-inner" 
                    : "bg-panel border-border text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        formData.permissoes[aba.id] ? "bg-blue-600 text-white" : "bg-input-bg"
                    )}>
                        <aba.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-tight" style={{ color: formData.permissoes[aba.id] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{aba.label}</span>
                  </div>
                  {formData.permissoes[aba.id] ? (
                    <CheckSquare className="h-5 w-5 text-blue-600 shadow-sm" />
                  ) : (
                    <Square className="h-5 w-5 text-slate-300 dark:text-slate-700" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 flex justify-end gap-4 pt-8 border-t border-border">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="rounded-xl bg-blue-600 px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all active:scale-95"
            >
              Salvar Setor
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
        title="Excluir setor?"
        message="Deseja realmente excluir este setor?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteSetor(deleteConfirmId);
            router.refresh();
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir o setor." });
          }
        }}
      />
    </div>
  );
}
