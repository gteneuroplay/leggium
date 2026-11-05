"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, Mic2, User, Search, Quote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BlockingModal } from "@/components/ui/BlockingModal";
import { upsertVisitante, deleteVisitante } from "./actions";
import { cn } from "@/lib/utils";

export function VisitantesClient({ initialData, vereadores }: { initialData: any[], vereadores: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nome_completo: "",
    representacao: "",
    motivo_visita: "",
    vereador_id: "",
    foto_url: "",
    disponivel_tribuna: false,
  });
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  const filteredData = initialData.filter(v => 
    v.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.representacao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (orador?: any) => {
    if (orador) {
      setEditingId(orador.id);
      setFormData({
        nome_completo: orador.nome_completo,
        representacao: orador.representacao || "",
        motivo_visita: orador.motivo_visita || "",
        vereador_id: orador.gabinete_destino_id || "",
        foto_url: orador.foto_url || "",
        disponivel_tribuna: Boolean(orador.disponivel_tribuna),
      });
    } else {
      setEditingId(null);
      setFormData({
        nome_completo: "",
        representacao: "",
        motivo_visita: "",
        vereador_id: "",
        foto_url: "",
        disponivel_tribuna: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertVisitante({ ...formData, id: editingId });
      setIsModalOpen(false);
      router.refresh();
    } catch (error) {
      setAlertModal({ title: "Erro ao salvar", message: "Não foi possível salvar o orador." });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Mic2 className="h-8 w-8 text-blue-500" />
            Oradores / Participantes
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Identificação de cidadãos e representantes para uso da palavra.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 premium-transition"
        >
          <Plus className="h-4 w-4" />
          Novo Orador
        </button>
      </div>

      {/* Busca */}
      <div className="relative group max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nome ou representação..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full premium-input rounded-xl py-3 pl-12 pr-4 shadow-sm"
        />
      </div>

      {/* Lista de Oradores */}
      <div className="flex-1 premium-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Foto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Orador</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tribuna</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Representação</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gabinete / Destino</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assunto</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((v) => {
                const vereador = vereadores.find(ver => ver.id === v.gabinete_destino_id);
                return (
                  <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 premium-transition">
                    <td className="px-6 py-4 w-[72px]">
                      <div className="h-11 w-11 rounded-full overflow-hidden border border-border bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                        {v.foto_url ? (
                          <img
                            src={v.foto_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">{v.nome_completo}</span>
                    </td>
                    <td className="px-6 py-4">
                      {v.disponivel_tribuna ? (
                        <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-500 border border-border">
                          Não
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {v.representacao || "Cidadão"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {vereador ? (vereador.nome_parlamentar || vereador.nome) : "Recepção / Geral"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Quote className="h-3 w-3 text-slate-400" />
                        <span className="italic truncate max-w-[200px]">{v.motivo_visita || "Não informado"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(v)} 
                          className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-white hover:bg-blue-500/10 rounded-lg premium-transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(v.id)} 
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg premium-transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Orador" : "Novo Orador"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo</label>
              <input
                type="text"
                required
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                className="w-full premium-input rounded-xl py-2.5 px-4"
                placeholder="Ex: José da Silva"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Representação / Cargo</label>
              <input
                type="text"
                value={formData.representacao}
                onChange={(e) => setFormData({ ...formData, representacao: e.target.value })}
                className="w-full premium-input rounded-xl py-2.5 px-4"
                placeholder="Ex: Presidente da Associação X..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Gabinete de Destino</label>
            <select
              value={formData.vereador_id}
              onChange={(e) => setFormData({ ...formData, vereador_id: e.target.value })}
              className="w-full premium-input rounded-xl py-2.5 px-4"
            >
              <option value="">Nenhum / Geral</option>
              {vereadores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome_parlamentar || v.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assunto / Motivo da Fala</label>
            <textarea
              rows={3}
              value={formData.motivo_visita}
              onChange={(e) => setFormData({ ...formData, motivo_visita: e.target.value })}
              className="w-full premium-input rounded-xl py-2.5 px-4"
              placeholder="Descreva brevemente sobre o que o orador irá falar..."
            />
          </div>

          <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-white/5 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.disponivel_tribuna}
                onChange={(e) => setFormData({ ...formData, disponivel_tribuna: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="text-sm font-medium text-foreground block">Disponível na tribuna</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  Quando marcado, o orador aparece no painel do operador para ser adicionado à fila da pauta; nome e foto podem ser exibidos na TV.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Foto</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Envie um ficheiro de imagem (JPEG, PNG, WebP ou GIF). A foto fica guardada no servidor após o envio.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-24 w-24 rounded-xl border border-border overflow-hidden bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                {formData.foto_url ? (
                  <img src={formData.foto_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-9 w-9 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingFoto}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadingFoto(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      fd.append("folder", "oradores");
                      const res = await fetch("/api/uploads/image", { method: "POST", body: fd });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error((j as { error?: string }).error || "Falha no upload");
                      const url = (j as { url?: string }).url;
                      if (url) setFormData((prev) => ({ ...prev, foto_url: url }));
                    } catch {
                      setAlertModal({ title: "Upload", message: "Não foi possível enviar a imagem." });
                    } finally {
                      setUploadingFoto(false);
                    }
                  }}
                  className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-500"
                />
                {formData.foto_url ? (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, foto_url: "" })}
                    className="self-start text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remover foto
                  </button>
                ) : null}
                {uploadingFoto ? <p className="text-xs text-slate-500">A enviar…</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 premium-transition"
            >
              Salvar Orador
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
        title="Excluir orador?"
        message="Este registro será removido permanentemente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!deleteConfirmId) return;
          try {
            await deleteVisitante(deleteConfirmId);
            router.refresh();
          } catch {
            setAlertModal({ title: "Erro", message: "Não foi possível excluir o registro." });
            throw new Error("keep-blocking-modal-open");
          }
        }}
      />
    </div>
  );
}
