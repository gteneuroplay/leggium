"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { rotuloAutoriaProposicao } from "@/lib/proposicao-autoria";
import { formatProposicaoTipoLabel } from "@/lib/proposicao-tipo-map";
import {
  textoAlternativoSistemaPainel,
  textoLeituraDiscussaoPainel,
  type ProposicaoPainelLeitura,
} from "@/lib/painel/texto-leitura-proposicao";

const PdfViewer = dynamic(() => import("@/app/tramitacao/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-blue-500">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-[9px] font-black uppercase tracking-widest">A carregar PDF…</span>
    </div>
  ),
});

function rotuloProposicaoCurto(p: ProposicaoPainelLeitura): string {
  const tipo = formatProposicaoTipoLabel(p.tipo ?? "");
  if (p.numero != null && p.ano != null) return `${tipo} ${p.numero}/${p.ano}`;
  if (p.ano != null) return `${tipo} ${p.ano}`;
  return tipo;
}

function CaixaTextoLeitura({
  titulo,
  texto,
  className,
}: {
  titulo: string;
  texto: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-1", className)}>
      <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {titulo}
      </span>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-left custom-scrollbar dark:bg-white/5">
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300 md:text-[15px]">
          {texto}
        </p>
      </div>
    </div>
  );
}

/** Discussão: só texto. Votação: PDF prioritário + texto do sistema opcional. */
export function PainelVereadorMateriaConteudo({
  proposicao,
  modo,
  className,
}: {
  proposicao: ProposicaoPainelLeitura | null | undefined;
  modo: "discussao" | "votacao";
  className?: string;
}) {
  const [mostrarTextoSistema, setMostrarTextoSistema] = useState(false);

  if (!proposicao) {
    return (
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        Sem conteúdo da matéria.
      </p>
    );
  }

  if (modo === "discussao") {
    const texto = textoLeituraDiscussaoPainel(proposicao);
    if (!texto) {
      return (
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Sem texto para leitura.
        </p>
      );
    }
    return <CaixaTextoLeitura titulo="Leitura da matéria" texto={texto} className={cn("mt-2", className)} />;
  }

  const pdfUrl = proposicao.pdf_url?.trim();
  const textoSistema = textoAlternativoSistemaPainel(proposicao);
  const textoFallback = textoLeituraDiscussaoPainel(proposicao);
  const ementa = (proposicao.ementa ?? "").trim();
  const rotulo = rotuloProposicaoCurto(proposicao);
  const autor = rotuloAutoriaProposicao(proposicao);

  if (pdfUrl) {
    return (
      <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col gap-1", className)}>
        <div className="flex shrink-0 items-center gap-2 border-b border-border/50 pb-1 min-w-0">
          <p
            className="min-w-0 flex-1 truncate text-[10px] sm:text-[11px] font-bold uppercase leading-tight text-foreground"
            title={`${rotulo} — ${autor}${ementa ? ` — ${ementa}` : ""}`}
          >
            <span className="text-blue-600 dark:text-blue-400">Votação · </span>
            {rotulo}
            <span className="font-semibold text-muted-foreground"> · {autor}</span>
          </p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
            title="Abrir PDF em nova janela"
          >
            <Download className="h-3 w-3" aria-hidden />
            PDF
          </a>
        </div>
        {ementa ? (
          <p className="shrink-0 line-clamp-1 text-[9px] text-muted-foreground" title={ementa}>
            {ementa}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-slate-100/90 custom-scrollbar dark:bg-slate-950/50 p-1 sm:p-2">
          <PdfViewer url={pdfUrl} />
        </div>
        {textoSistema ? (
          <div className="shrink-0 border-t border-border/50 pt-1">
            <button
              type="button"
              onClick={() => setMostrarTextoSistema((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              <FileText className="h-3 w-3 shrink-0" aria-hidden />
              {mostrarTextoSistema ? "Ocultar texto do sistema" : "Texto IA/editor"}
            </button>
            {mostrarTextoSistema ? (
              <div className="mt-1 max-h-[120px] overflow-y-auto custom-scrollbar rounded border border-border bg-slate-50 px-2 py-1.5 dark:bg-white/5">
                <p className="text-[10px] leading-relaxed whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">
                  {textoSistema}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (textoFallback) {
    return <CaixaTextoLeitura titulo="Leitura da matéria" texto={textoFallback} className={className} />;
  }

  return (
    <div
      className={cn(
        "relative z-10 flex flex-1 items-center justify-center text-muted-foreground",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <AlertCircle className="h-8 w-8 opacity-40" aria-hidden />
        <p className="text-[10px] font-black uppercase tracking-wider">Sem PDF nem texto para consulta</p>
      </div>
    </div>
  );
}
