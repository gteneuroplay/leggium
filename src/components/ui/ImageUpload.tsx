"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockingModal } from "@/components/ui/BlockingModal";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
  aspectRatio?: "1:1" | "none";
}

export function ImageUpload({ value, onChange, className, aspectRatio = "none" }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrorModal, setUploadErrorModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (aspectRatio === "none") return resolve(file);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const size = Math.min(img.width, img.height);
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);

          // Centraliza o recorte
          const xOffset = (img.width - size) / 2;
          const yOffset = (img.height - size) / 2;

          ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, size, size);

          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            const processedFile = new File([blob], file.name, { type: "image/jpeg" });
            resolve(processedFile);
          }, "image/jpeg", 0.9);
        };
      };
    });
  };

  const handleUpload = async (rawFile: File) => {
    try {
      setIsUploading(true);
      
      const file = await processImage(rawFile);
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "fotos");

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha no upload da imagem.");
      }

      const data = await response.json();
      onChange(data.url);
    } catch (error) {
      console.error('Erro no upload:', error);
      const msg =
        error instanceof Error ? error.message : "Erro ao fazer upload da imagem.";
      setUploadErrorModal(msg);
    } finally {
      setIsUploading(false);
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
    if (file) handleUpload(file);
  };

  return (
    <div className={cn("space-y-4 w-full", className)}>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative h-64 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden premium-transition",
          isDragging 
            ? "border-blue-500 bg-blue-500/10" 
            : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20",
          value && "border-none"
        )}
      >
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />

        {value ? (
          <>
            <img src={value} alt="Preview" className="w-full h-full object-contain bg-black/20" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center premium-transition">
              <p className="text-white text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" /> Alterar Foto
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 premium-transition shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400 p-6 text-center">
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                <p className="text-sm font-medium text-slate-300">Processando e enviando...</p>
              </>
            ) : (
              <>
                <div className="p-4 rounded-full bg-white/5 border border-white/10">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Arraste a foto oficial</p>
                  <p className="text-xs mt-1">
                    {aspectRatio === "1:1" ? "A imagem será salva no formato quadrado" : "Clique para selecionar"}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <BlockingModal
        isOpen={uploadErrorModal !== null}
        onClose={() => setUploadErrorModal(null)}
        mode="alert"
        title="Upload da imagem"
        message={uploadErrorModal ?? ""}
      />
    </div>
  );
}
