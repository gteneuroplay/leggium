"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Search, Edit2, Trash2, 
  Building2, Hash, Image as ImageIcon,
  CheckCircle2, Users
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { upsertBancada, deleteBancada } from "./actions";

export function BancadasClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    sigla: "",
    logo_url: "",
  });

  const filteredData = initialData.filter(b => 
    b.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.sigla.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPartidos = initialData.length;

  const handleOpenModal = (bancada?: any) => {
    if (bancada) {
      setEditingId(bancada.id);
      setFormData({
        nome: bancada.nome,
        sigla: bancada.sigla,
        logo_url: bancada.logo_url || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: "",
        sigla: "",
        logo_url: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertBancada({ ...formData, id: editingId });
      setIsModalOpen(false);
    } catch (error) {
      setAlertModal({ title: "Erro ao salvar", message: "Não foi possível salvar a bancada." });
    }
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-1 flex items-center gap-3">
            <Building2 className="h-9 w-9 text-indigo-600 dark:text-indigo-400" />
            Bancadas e Partidos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gestão das legendas partidárias representadas na Câmara.</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-600/10 border border-indigo-600/20 px-4 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Total de Partidos</span>
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">{totalPartidos}</span>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 premium-transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nova Bancada
        </button>
      </div>

      {/* Busca */}
      <div className="relative group max-w-2xl w-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou sigla..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full premium-input rounded-xl py-4 pl-14 pr-6 shadow-lg"
        />
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredData.length === 0 ? (
          <div className="col-span-full premium-panel rounded-xl p-20 text-center text-slate-500 border-dashed border-2 opacity-50 flex flex-col items-center gap-4">
            <ImageIcon size={64} className="text-slate-300" />
            <p className="font-black uppercase tracking-[0.2em] text-xs">Nenhuma bancada cadastrada</p>
          </div>
        ) : (
          filteredData.map((b) => (
            <div key={b.id} className="premium-panel p-8 rounded-xl border border-border hover:border-indigo-500/50 premium-transition group relative shadow-xl hover:shadow-2xl">
              <div className="absolute -right-4 -top-4 h-32 w-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 premium-transition" />
              
              <div className="flex items-start justify-between relative z-10 mb-8">
                <div className="flex items-center gap-5">
                  <div className="h-20 w-20 rounded-xl bg-panel border border-border flex items-center justify-center overflow-hidden shadow-sm p-2">
                    {b.logo_url ? (
                      <img src={b.logo_url} alt={b.sigla} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{b.sigla.slice(0, 3)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>{b.nome}</h3>
                    <p className="text-indigo-700 dark:text-indigo-400 font-black text-sm uppercase tracking-widest mt-1">{b.sigla}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 premium-transition">
                  <button 
                    onClick={() => handleOpenModal(b)} 
                    className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-600/10 rounded-xl premium-transition"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(b.id)} 
                    className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl premium-transition"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-border flex items-center justify-between relative z-10 mb-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <span>Membros da Bancada</span>
                </div>
                <span className="text-[10px] font-black text-white bg-indigo-600 px-3 py-1 rounded-full shadow-lg shadow-indigo-600/20">
                  {b.vereadores?.length || 0}
                </span>
              </div>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {b.vereadores?.length > 0 ? (
                  b.vereadores.map((v: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 rounded-xl bg-panel border border-border shadow-sm hover:border-indigo-500/30 premium-transition group/item"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-input-bg border border-border overflow-hidden flex-shrink-0 shadow-sm">
                          {v.foto_url ? (
                            <img src={v.foto_url} alt={v.nome_parlamentar} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                              {v.nome_parlamentar.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 premium-transition" style={{ color: 'var(--text-primary)' }}>
                            {v.nome_parlamentar}
                          </p>
                          <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                            {v.cargo_mesa === 'MEMBRO' ? 'Vereador(a)' : v.cargo_mesa}
                          </p>
                        </div>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${v.cargo_mesa === 'PRESIDENTE' ? 'bg-amber-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-input-bg/50 rounded-xl border border-dashed border-border">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Nenhum vereador vinculado</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Bancada" : "Cadastrar Nova Bancada"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Hash className="h-4 w-4 text-indigo-500" />
                Sigla
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={formData.sigla}
                onChange={(e) => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                placeholder="Ex: PND"
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm font-black uppercase"
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do Partido / Bancada</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Partido Nacional Democrático"
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
              <ImageIcon className="h-4 w-4 text-indigo-500" />
              Logo da Bancada / Partido
            </label>
            <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-xl border border-border">
              <ImageUpload 
                value={formData.logo_url}
                onChange={(url) => setFormData({ ...formData, logo_url: url })}
              />
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
              className="rounded-xl bg-indigo-600 px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95 flex items-center gap-3"
            >
              <CheckCircle2 className="h-4 w-4" />
              Salvar Bancada
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
        title="Excluir bancada?"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteBancada(deleteConfirmId);
            router.refresh();
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir a bancada." });
            throw new Error("keep-blocking-modal-open");
          }
        }}
      />
    </div>
  );
}
