"use client";

import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';

// Configuração do worker do PDF.js (como roda só no cliente, não dará erro de SSR)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center justify-start min-h-full">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="flex flex-col items-center justify-center py-20 text-blue-400 gap-3">
            <Loader2 size={32} className="animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Carregando Documento...</span>
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center py-20 text-red-400 gap-3">
            <AlertCircle size={32} />
            <span className="text-sm font-bold uppercase tracking-widest">Erro ao carregar PDF</span>
          </div>
        }
        className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto"
      >
        {Array.from(new Array(numPages || 0), (el, index) => (
          <div key={`page_${index + 1}`} className="bg-white rounded shadow-2xl p-2 w-full flex justify-center">
            <Page 
              pageNumber={index + 1} 
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="max-w-full"
              width={800}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
