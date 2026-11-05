"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Gavel, User, Flag, Lock, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { upsertVereador, deleteVereador } from "./actions";

const CARGO_MESA_LABELS = {
  PRESIDENTE: "Presidente",
  VICE_PRESIDENTE: "Vice-Presidente",
  PRIMEIRO_SECRETARIO: "1º Secretário",
  SEGUNDO_SECRETARIO: "2º Secretário",
  MEMBRO: "Vereador(a)"
};

export function VereadoresClient({ initialData, bancadas, settings }: { 
  initialData: any[], 
  bancadas: any[],
  settings?: { email_domain?: string }
}) {
  const emailDomain = settings?.email_domain || "syslegis.com";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vereadores, setVereadores] = useState(initialData);

  // Sincronizar estado quando as props mudarem
  useEffect(() => {
    setVereadores(initialData);
  }, [initialData]);

  const [formData, setFormData] = useState({
    nome_parlamentar: "",
    bancada_id: "",
    foto_url: "",
    status_mandato: true,
    cargo_mesa: "MEMBRO",
    username: "",
    password: "",
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  const handleOpenModal = (vereador?: any) => {
    if (vereador) {
      setEditingId(vereador.id);
      setFormData({
        nome_parlamentar: vereador.nome_parlamentar,
        bancada_id: vereador.bancada_id || "",
        foto_url: vereador.foto_url || "",
        status_mandato: vereador.status_mandato,
        cargo_mesa: vereador.cargo_mesa || "MEMBRO",
        username: vereador.user?.username || vereador.user?.email?.split("@")[0] || "",
        password: "",
      });
    } else {
      setEditingId(null);
      setFormData({
        nome_parlamentar: "",
        bancada_id: "",
        foto_url: "",
        status_mandato: true,
        cargo_mesa: "MEMBRO",
        username: "",
        password: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de senha curta
    if (formData.password && formData.password.length < 6) {
      setAlertModal({
        title: "Senha inválida",
        message: "A senha deve ter no mínimo 6 caracteres.",
      });
      return;
    }

    try {
      await upsertVereador({ ...formData, id: editingId });
      setIsModalOpen(false);
    } catch (error: any) {
      setAlertModal({
        title: "Erro ao salvar",
        message: error.message || "Não foi possível salvar o vereador.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-1 flex items-center gap-3">
            <Gavel className="h-9 w-9 text-blue-600 dark:text-blue-400" />
            Vereadores
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gestão parlamentar e credenciais de acesso.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 premium-transition active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Novo Vereador
        </button>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {vereadores.length === 0 ? (
          <div className="col-span-full premium-panel rounded-xl p-20 text-center text-slate-500 border-dashed border-2 opacity-50 flex flex-col items-center gap-4">
            <User size={64} className="text-slate-300" />
            <p className="font-black uppercase tracking-[0.2em] text-xs">Nenhum vereador cadastrado</p>
          </div>
        ) : (
          vereadores.map((vereador) => (
            <div key={vereador.id} className="premium-panel rounded-xl overflow-hidden group hover:border-blue-500/50 shadow-xl hover:shadow-2xl premium-transition flex flex-col border border-border">
              <div className="h-64 bg-white dark:bg-slate-800/50 relative flex items-center justify-center overflow-hidden border-b border-border shadow-inner">
                {vereador.foto_url ? (
                  <img src={vereador.foto_url} alt={vereador.nome_parlamentar} className="w-full h-full object-contain group-hover:scale-105 premium-transition p-2" />
                ) : (
                  <div className="w-full h-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                    <User className="h-24 w-24 text-slate-200 dark:text-slate-700" />
                  </div>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between bg-panel relative">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-panel border border-border flex items-center justify-center overflow-hidden shadow-sm">
                        {vereador.bancada?.logo_url ? (
                          <img src={vereador.bancada.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Flag className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{vereador.bancada?.sigla || "Sem Partido"}</span>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${vereador.status_mandato ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-slate-500/10 text-slate-500 border-slate-500/20"}`}>
                      {vereador.status_mandato ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <h3 className="text-xl font-black leading-tight tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
                    {vereador.nome_parlamentar}
                  </h3>

                  {vereador.cargo_mesa && vereador.cargo_mesa !== 'MEMBRO' && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-sm">
                      <Gavel className="h-3 w-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {CARGO_MESA_LABELS[vereador.cargo_mesa as keyof typeof CARGO_MESA_LABELS]}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-5 border-t border-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <div className="p-1.5 bg-panel border border-border shadow-sm rounded-lg">
                       <User className="h-3 w-3 text-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold truncate lowercase" style={{ color: 'var(--text-secondary)' }}>
                      {vereador.user?.email || 'sem acesso'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleOpenModal(vereador)} 
                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-blue-600/10 rounded-xl premium-transition"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmId(vereador.id)} 
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl premium-transition"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Vereador" : "Novo Vereador"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="h-px flex-1 bg-border" />
               <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">Dados Parlamentares</h3>
               <div className="h-px flex-1 bg-border" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Parlamentar</label>
                <input
                  type="text"
                  required
                  value={formData.nome_parlamentar}
                  onChange={(e) => setFormData({ ...formData, nome_parlamentar: e.target.value })}
                  className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                  placeholder="Ex: Vereador João Silva"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Cargo na Mesa</label>
                <select
                  value={formData.cargo_mesa}
                  onChange={(e) => setFormData({ ...formData, cargo_mesa: e.target.value })}
                  className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                >
                  {Object.entries(CARGO_MESA_LABELS).map(([value, label]) => (
                    <option key={value} value={value} className="bg-panel text-foreground">{label}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Bancada / Partido</label>
                <select
                  required
                  value={formData.bancada_id}
                  onChange={(e) => setFormData({ ...formData, bancada_id: e.target.value })}
                  className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                >
                  <option value="" className="bg-panel text-foreground">Selecione...</option>
                  {bancadas.map((b) => (
                    <option key={b.id} value={b.id} className="bg-panel text-foreground">{b.sigla} - {b.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block">Foto Oficial</label>
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-border">
                <ImageUpload 
                  value={formData.foto_url}
                  onChange={(url) => setFormData({ ...formData, foto_url: url })}
                  aspectRatio="1:1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="h-px flex-1 bg-border" />
               <h3 className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Acesso ao Sistema
               </h3>
               <div className="h-px flex-1 bg-border" />
            </div>
            
            <div className="grid grid-cols-1 gap-8 p-8 bg-slate-50 dark:bg-white/5 rounded-xl border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Usuário de Acesso</label>
                  <div className="flex items-stretch rounded-xl premium-input overflow-hidden shadow-sm border border-border group focus-within:border-blue-500 transition-colors">
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/\s/g, '.');
                        setFormData({ ...formData, username: val });
                      }}
                      placeholder="ex: ver.joao"
                      className="min-w-[120px] flex-1 bg-transparent border-0 py-3 px-4 text-foreground placeholder:text-slate-400 focus:ring-0 text-sm font-bold outline-none"
                    />
                    <div className="flex-shrink-0 flex items-center px-4 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 text-xs font-black select-none border-l border-border whitespace-nowrap">
                      @{emailDomain}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Senha de Acesso</label>
                  <input
                    type="password"
                    required={!editingId}
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingId ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                    className="w-full premium-input rounded-xl py-3 px-4 shadow-sm text-sm font-bold border border-border focus:border-blue-500 outline-none transition-colors"
                  />
                </div>
              </div>
              
              <div className="flex items-start gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider bg-white/40 dark:bg-black/20 p-4 rounded-xl border border-border/50">
                <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">
                  O vereador utilizará este usuário (ou e-mail) e senha para realizar login, acessar o painel de votação e registrar suas decisões parlamentares.
                </p>
              </div>
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
              Salvar Vereador
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
        title="Excluir vereador?"
        message="O registro será removido e o acesso ao sistema também será revogado."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteVereador(deleteConfirmId);
            setVereadores((prev) => prev.filter((v) => v.id !== deleteConfirmId));
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir o vereador." });
          }
        }}
      />
    </div>
  );
}
