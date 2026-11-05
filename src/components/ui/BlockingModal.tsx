"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type BlockingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | ReactNode;
  /** alert = só OK | confirm = Cancelar + Confirmar */
  mode: "alert" | "confirm";
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Somente mode confirm */
  onConfirm?: () => void | Promise<void>;
  /** Se false, não chama onClose após onConfirm concluir com sucesso (ex.: fluxo em duas etapas). Padrão: true. */
  closeAfterSuccessfulConfirm?: boolean;
  /** Se false, oculta o botão secundário (modo confirm). */
  showCancel?: boolean;
};

export function BlockingModal({
  isOpen,
  onClose,
  title,
  message,
  mode,
  danger = false,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  closeAfterSuccessfulConfirm = true,
  showCancel = true,
}: BlockingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, submitting]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm();
      if (closeAfterSuccessfulConfirm) onClose();
    } catch {
      // Falha tratada no caller (ex.: modal de alerta); mantém este modal aberto.
    } finally {
      setSubmitting(false);
    }
  };

  const primaryLabel = mode === "alert" ? "OK" : confirmLabel ?? "Confirmar";

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
        onClick={() => {
          if (mode === "alert" && !submitting) onClose();
        }}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocking-modal-title"
        aria-describedby="blocking-modal-desc"
        className={cn(
          "relative z-[1101] w-full max-w-md rounded-xl border border-border bg-panel shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4 p-6 border-b border-border">
          {danger && mode === "confirm" && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600/15 text-red-500 border border-red-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="blocking-modal-title" className="text-lg font-black text-foreground uppercase tracking-tight leading-tight">
              {title}
            </h2>
            <div
              id="blocking-modal-desc"
              className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed whitespace-pre-wrap"
            >
              {message}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:gap-3 bg-slate-50/50 dark:bg-black/20 rounded-b-xl">
          {mode === "confirm" && showCancel && (
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-border px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={mode === "alert" ? onClose : handleConfirm}
            className={cn(
              "rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50",
              danger && mode === "confirm"
                ? "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/20"
                : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20"
            )}
          >
            {submitting ? "…" : primaryLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
