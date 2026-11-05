"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = "lg",
}: ModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const sizeClasses = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-6xl",
  };

  if (!isMounted) return null;
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          "relative z-[1001] mx-auto flex w-full min-h-0 max-h-[min(90dvh,90vh)] flex-col overflow-hidden rounded-2xl",
          "bg-panel border-2 border-border shadow-2xl ring-1 ring-white/10",
          "animate-in fade-in zoom-in-95 duration-300 ease-out",
          sizeClasses[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4 sm:px-8 sm:py-5">
          <h2 id="modal-title" className="text-xl font-bold tracking-tight text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="group rounded-full p-2 text-slate-400 premium-transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5 premium-transition group-hover:rotate-90" />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-8">
          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
              margin: 8px 0;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(59, 130, 246, 0.5);
            }
          `}</style>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
