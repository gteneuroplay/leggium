"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Edit2, Trash2, ClipboardList, 
  Users, User, Star, Gavel, FileSearch,
  Search, X
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { upsertComissao, deleteComissao } from "./actions";

export function ComissoesClient({ initialData, vereadores }: { initialData: any[], vereadores: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    sigla: "",
    presidente_id: "",
    relator_id: "",
    membros_ids: [] as string[],
  });

  const filteredData = initialData.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sigla.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (comissao?: any) => {
    if (comissao) {
      setEditingId(comissao.id);
      setFormData({
        nome: comissao.nome,
        sigla: comissao.sigla,
        presidente_id: comissao.presidente_id,
        relator_id: comissao.relator_id,
        membros_ids: comissao.membros?.map((m: any) => m.vereador_id) || [],
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: "",
        sigla: "",
        presidente_id: "",
        relator_id: "",
        membros_ids: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.presidente_id || !formData.relator_id) {
      setAlertModal({
        title: "Campos obrigatórios",
        message: "Presidente e Relator são obrigatórios.",
      });
      return;
    }
    try {
      await upsertComissao({ ...formData, id: editingId });
      setIsModalOpen(false);
    } catch (error) {
      setAlertModal({ title: "Erro ao salvar", message: "Não foi possível salvar a comissão." });
    }
  };

  const toggleMembro = (vId: string) => {
    setFormData(prev => ({
      ...prev,
      membros_ids: prev.membros_ids.includes(vId)
        ? prev.membros_ids.filter(id => id !== vId)
        : [...prev.membros_ids, vId]
    }));
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-1 flex items-center gap-3">
            <ClipboardList className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            Comissões
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gestão das comissões permanentes e temporárias.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 premium-transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nova Comissão
        </button>
      </div>

      {/* Busca */}
      <div className="relative group max-w-2xl w-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors z-10" />
        <input 
          type="text" 
          placeholder="Buscar comissão por nome ou sigla..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full premium-input rounded-xl py-4 pl-14 pr-6 shadow-lg"
        />
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredData.map((comissao) => (
          <div key={comissao.id} className="premium-panel p-8 rounded-xl border border-border hover:border-blue-500/50 premium-transition group shadow-xl hover:shadow-2xl flex flex-col relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] premium-transition">
               <ClipboardList size={120} />
             </div>

             <div className="flex items-start justify-between relative z-10 mb-8">
                <div>
                  <h3 className="text-xl font-black tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>{comissao.nome}</h3>
                  <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{comissao.sigla}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 premium-transition">
                  <button 
                    onClick={() => handleOpenModal(comissao)} 
                    className="p-2.5 text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-blue-600/10 rounded-xl premium-transition"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(comissao.id)} 
                    className="p-2.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl premium-transition"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
             </div>

             {/* Liderança */}
             <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                <div className="bg-input-bg p-4 rounded-xl border border-border shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-3 w-3 text-amber-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Presidente</span>
                  </div>
                  <p className="text-xs font-black truncate" style={{ color: 'var(--text-primary)' }}>{comissao.presidente?.nome_parlamentar}</p>
                </div>
                <div className="bg-input-bg p-4 rounded-xl border border-border shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <FileSearch className="h-3 w-3 text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Relator</span>
                  </div>
                  <p className="text-xs font-black truncate" style={{ color: 'var(--text-primary)' }}>{comissao.relator?.nome_parlamentar}</p>
                </div>
             </div>

             <div className="pt-6 border-t border-border flex items-center justify-between relative z-10 mb-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>Membros</span>
                </div>
                <span className="text-[10px] font-black text-white bg-blue-600 px-3 py-1 rounded-full shadow-lg shadow-blue-600/20">
                  {comissao.membros?.length || 0}
                </span>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {comissao.membros?.map((m: any) => (
                  <div key={m.vereador_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-panel border border-border/50">
                    <div className="h-7 w-7 rounded-full bg-input-bg overflow-hidden flex-shrink-0 border border-border">
                      {m.vereador?.foto_url ? (
                        <img src={m.vereador.foto_url} className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-4 w-4 text-slate-300 m-auto mt-1" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{m.vereador?.nome_parlamentar}</p>
                      <p className="text-[8px] font-black text-blue-600/70 uppercase">{m.vereador?.bancada?.sigla}</p>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Comissão" : "Nova Comissão"}>
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
                placeholder="Ex: CCJ"
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome da Comissão</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm font-bold"
                placeholder="Ex: Comissão de Constituição e Justiça"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Presidente
              </label>
              <select
                required
                value={formData.presidente_id}
                onChange={(e) => setFormData({ ...formData, presidente_id: e.target.value })}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              >
                <option value="">Selecione...</option>
                {vereadores.map(v => (
                  <option key={v.id} value={v.id}>{v.nome_parlamentar}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-blue-500" /> Relator
              </label>
              <select
                required
                value={formData.relator_id}
                onChange={(e) => setFormData({ ...formData, relator_id: e.target.value })}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              >
                <option value="">Selecione...</option>
                {vereadores.map(v => (
                  <option key={v.id} value={v.id}>{v.nome_parlamentar}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              Membros da Comissão
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-6 bg-input-bg rounded-xl border border-border max-h-[300px] overflow-y-auto custom-scrollbar">
              {vereadores.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleMembro(v.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                    formData.membros_ids.includes(v.id)
                      ? "bg-blue-600/10 border-blue-600/40 shadow-inner"
                      : "bg-panel border-border hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-input-bg overflow-hidden flex-shrink-0 border border-border">
                    {v.foto_url ? (
                      <img src={v.foto_url} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-slate-300 m-auto mt-1.5" />
                    )}
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-[11px] font-black truncate leading-tight" style={{ color: formData.membros_ids.includes(v.id) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {v.nome_parlamentar}
                    </p>
                    <p className="text-[8px] font-black text-slate-400 uppercase">{v.bancada?.sigla}</p>
                  </div>
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
              Salvar Comissão
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
        title="Excluir comissão?"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteComissao(deleteConfirmId);
            router.refresh();
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir a comissão." });
            throw new Error("keep-blocking-modal-open");
          }
        }}
      />
    </div>
  );
}
