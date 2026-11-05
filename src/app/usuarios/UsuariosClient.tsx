"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, Users, ShieldCheck, Mail, Building2, Lock, User as UserIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { upsertUsuario, deleteUsuario } from "./actions";

export function UsuariosClient({ 
  initialData, 
  setores 
}: { 
  initialData: any[], 
  setores: any[]
}) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    username: "",
    password: "",
    role: "OPERADOR",
    setor_id: "",
    status: true,
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  const handleOpenModal = (usuario?: any) => {
    if (usuario) {
      setEditingId(usuario.id);
      setFormData({
        nome: usuario.nome,
        email: usuario.email || "",
        username: usuario.username || "",
        password: "", // Senha nunca é carregada por segurança
        role: usuario.role,
        setor_id: usuario.setor_id || "",
        status: usuario.status,
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: "",
        email: "",
        username: "",
        password: "",
        role: "OPERADOR",
        setor_id: "",
        status: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertUsuario({ ...formData, id: editingId });
      setIsModalOpen(false);
    } catch (error: any) {
      setAlertModal({
        title: "Erro ao salvar",
        message:
          "Erro ao salvar o usuário: " + (error?.message || "Erro desconhecido"),
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground mb-2 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Usuários (Funcionários)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Contas de acesso para servidores e assessores da Câmara.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 premium-transition"
        >
          <Plus className="h-4 w-4" />
          Novo Funcionário
        </button>
      </div>

      {/* Tabela */}
      <div className="flex-1 premium-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nome / Usuário</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Setor / Cargo</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialData.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 premium-transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black">
                        {usuario.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{usuario.nome}</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> @{usuario.username || 'sem-username'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      usuario.role === 'ADMIN_CAMARA' 
                      ? "text-blue-600 dark:text-blue-400 bg-blue-600/10 border-blue-600/20" 
                      : "text-emerald-600 dark:text-emerald-400 bg-emerald-600/10 border-emerald-600/20"
                    }`}>
                      <Building2 className="h-3 w-3 mr-1.5" />
                      {usuario.setor?.nome || (usuario.role === 'ADMIN_CAMARA' ? 'Admin Câmara' : 'Geral')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${usuario.status ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-400"}`} />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">{usuario.status ? "Ativo" : "Inativo"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(usuario)} 
                        className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-blue-600/10 rounded-lg premium-transition"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(usuario.id)} 
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg premium-transition"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Funcionário" : "Novo Funcionário"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Completo</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-blue-500" />
                Usuário (Login)
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '.') })}
                placeholder="ex: joao.silva"
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-500" />
                Senha
              </label>
              <input
                type="password"
                required={!editingId}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingId ? "Deixe em branco para manter" : "Defina a senha"}
                className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
              />
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  Setor
                </label>
                <select
                  value={formData.setor_id}
                  onChange={(e) => setFormData({ ...formData, setor_id: e.target.value })}
                  className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                >
                  <option value="" className="bg-panel text-foreground">Nenhum (Geral)</option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id} className="bg-panel text-foreground">{s.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  Perfil de Acesso
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full premium-input rounded-xl py-3 px-4 shadow-sm"
                >
                  <option value="ADMIN_CAMARA" className="bg-panel text-foreground">Administrador Câmara</option>
                  <option value="OPERADOR" className="bg-panel text-foreground">Operador de Plenário</option>
                  <option value="SECRETARIA" className="bg-panel text-foreground">Secretaria Legislativa</option>
                  <option value="JURIDICO" className="bg-panel text-foreground">Jurídico</option>
                  <option value="COMISSAO" className="bg-panel text-foreground">Comissões</option>
                  <option value="VEREADOR" className="bg-panel text-foreground">Vereador</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-border">
             <input
              type="checkbox"
              id="status"
              checked={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
              className="h-5 w-5 rounded-lg border-border bg-panel text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
            />
            <label htmlFor="status" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer uppercase tracking-widest">
              Conta Ativada
            </label>
          </div>

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
              Salvar Usuário
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
        title="Excluir usuário?"
        message="O acesso desta conta será revogado imediatamente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteUsuario(deleteConfirmId);
            router.refresh();
          } catch {
            setAlertModal({
              title: "Erro",
              message: "Não foi possível excluir o usuário.",
            });
            throw new Error("keep-blocking-modal-open");
          }
        }}
      />
    </div>
  );
}
