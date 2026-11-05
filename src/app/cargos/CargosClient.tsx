"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Search, Edit2, Trash2, 
  ShieldCheck, CheckSquare, Square,
  LayoutDashboard, CalendarDays, FileText, 
  Vote, Building2, Gavel, Mic2, Users, Settings, Scale, ClipboardList, Tv, Video
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { upsertCargo, deleteCargo } from "./actions";
import { cn } from "@/lib/utils";

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

export function CargosClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    permissoes: {} as Record<string, boolean>,
  });

  const filteredData = initialData.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (cargo?: any) => {
    if (cargo) {
      setEditingId(cargo.id);
      setFormData({
        nome: cargo.nome,
        permissoes: cargo.permissoes || {},
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: "",
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
      await upsertCargo({ ...formData, id: editingId });
      setIsModalOpen(false);
    } catch (error) {
      setAlertModal({ title: "Erro ao salvar", message: "Não foi possível salvar o cargo." });
    }
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-1 flex items-center gap-3">
            <ShieldCheck className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
            Cargos e Permissões
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Defina os perfis de acesso para cada função na Câmara.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 premium-transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Novo Cargo
        </button>
      </div>

      {/* Busca */}
      <div className="relative group max-w-2xl w-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors z-10" />
        <input 
          type="text" 
          placeholder="Buscar cargo por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full premium-input rounded-xl py-4 pl-14 pr-6 shadow-lg"
        />
      </div>

      {/* Listagem */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredData.map((cargo) => (
          <div key={cargo.id} className="premium-panel p-8 rounded-xl border border-border hover:border-emerald-500/50 premium-transition group shadow-xl hover:shadow-2xl flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight leading-tight">{cargo.nome}</h3>
                <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                  {Object.values(cargo.permissoes || {}).filter(Boolean).length} ABAS LIBERADAS
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 premium-transition">
                <button 
                  onClick={() => handleOpenModal(cargo)} 
                  className="p-2.5 text-slate-400 hover:text-emerald-600 dark:hover:text-white hover:bg-emerald-600/10 rounded-xl premium-transition"
                  title="Editar"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(cargo.id)} 
                  className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl premium-transition"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-auto pt-6 border-t border-border">
              {ABAS_SISTEMA.map(aba => cargo.permissoes?.[aba.id] && (
                <span key={aba.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-border shadow-sm">
                  <aba.icon className="h-3.5 w-3.5 text-emerald-500" />
                  {aba.label}
                </span>
              ))}
              {Object.values(cargo.permissoes || {}).filter(Boolean).length === 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic py-2">Sem acessos configurados</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Cargo" : "Criar Novo Cargo"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Cargo</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Assessor Legislativo"
              className="w-full premium-input rounded-xl py-3 px-4 shadow-sm font-bold"
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Permissões do Cargo
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
                    ? "bg-emerald-600/10 border-emerald-600/40 text-foreground shadow-inner" 
                    : "bg-panel border-border text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        formData.permissoes[aba.id] ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                    )}>
                        <aba.icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-tight">{aba.label}</span>
                  </div>
                  {formData.permissoes[aba.id] ? (
                    <CheckSquare className="h-5 w-5 text-emerald-600 shadow-sm" />
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
              className="rounded-xl bg-emerald-600 px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-95"
            >
              Salvar Cargo
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
        title="Excluir cargo?"
        message="Os usuários vinculados ficarão sem cargo."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteCargo(deleteConfirmId);
            router.refresh();
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir o cargo." });
            throw new Error("keep-blocking-modal-open");
          }
        }}
      />
    </div>
  );
}
