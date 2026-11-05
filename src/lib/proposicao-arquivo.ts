import { isProposicaoPautaManual } from "@/lib/pauta/pauta-manual";

/** Texto gravado quando o integral está só no PDF/DOCX importado. */
export const TEXTO_PROPOSICAO_DOCUMENTO_IMPORTADO =
  "O texto integral consta do documento importado (PDF ou DOCX) anexo a esta proposição.";

export const PROPOSICAO_ARQUIVO_MAX_BYTES = 15 * 1024 * 1024;

export const PROPOSICAO_ARQUIVO_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isProposicaoArquivoPdf(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".pdf") || file.type === "application/pdf";
}

export function isProposicaoArquivoDocx(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function validateProposicaoArquivo(file: File): void {
  if (!isProposicaoArquivoPdf(file) && !isProposicaoArquivoDocx(file)) {
    throw new Error("Formato não suportado. Envie um ficheiro PDF ou DOCX.");
  }
  if (file.size === 0) {
    throw new Error("O ficheiro está vazio.");
  }
  if (file.size > PROPOSICAO_ARQUIVO_MAX_BYTES) {
    throw new Error("Ficheiro demasiado grande. O limite é 15 MB.");
  }
}

export function proposicaoTextoParaHtml(texto: string | null | undefined): string {
  const t = (texto ?? "").trim();
  if (!t) return "";
  if (t.startsWith("<")) return t;
  return t.replace(/\n/g, "<br/>");
}

function normalizarTextoProposicao(texto: string): string {
  return texto.trim().replace(/\s+/g, " ");
}

/** Marcadores gravados em `texto_completo` para proposições cujo integral está no ficheiro. */
const MARCADORES_TEXTO_DOCUMENTO_IMPORTADO = [
  TEXTO_PROPOSICAO_DOCUMENTO_IMPORTADO,
  "O texto integral consta do documento importado (PDF) anexo a esta proposição.",
  "O texto integral consta do documento importado (PDF ou DOCX) anexo a esta proposição.",
  "O texto integral consta do PDF importado.",
];

/** Verifica se o texto começa com marcador de documento importado (com ou sem corpo extraído do PDF). */
export function textoEhDocumentoImportado(texto: string | null | undefined): boolean {
  const raw = (texto ?? "").trim();
  if (!raw) return false;
  return MARCADORES_TEXTO_DOCUMENTO_IMPORTADO.some(
    (m) => raw === m || raw.startsWith(`${m}\n`) || raw.startsWith(`${m}\r\n`),
  );
}

/** Corpo editável após o marcador de PDF importado (texto extraído do documento). */
export function corpoTextoDocumentoImportado(texto: string | null | undefined): string {
  const raw = (texto ?? "").trim();
  if (!raw) return "";
  for (const m of MARCADORES_TEXTO_DOCUMENTO_IMPORTADO) {
    if (raw === m) return "";
    if (raw.startsWith(`${m}\n`) || raw.startsWith(`${m}\r\n`)) {
      return raw.slice(m.length).trim();
    }
  }
  return raw;
}

/** Grava marcador + texto extraído do PDF para consulta no painel e tramitação. */
export function textoCompletoDocumentoImportado(corpo?: string | null): string {
  const c = (corpo ?? "").trim();
  if (!c) return TEXTO_PROPOSICAO_DOCUMENTO_IMPORTADO;
  if (textoEhDocumentoImportado(c)) return c;
  return `${TEXTO_PROPOSICAO_DOCUMENTO_IMPORTADO}\n\n${c}`;
}

/**
 * PDF enviado pelo utilizador (upload), em oposição ao PDF gerado a partir do texto no sistema.
 * Exige `pdf_url` e texto marcado como importado (ou legado equivalente).
 */
export function proposicaoTemPdfImportado(proposicao: {
  pdf_url?: string | null;
  texto_completo?: string | null;
} | null | undefined): boolean {
  if (!proposicao?.pdf_url?.trim()) return false;
  if (textoEhDocumentoImportado(proposicao.texto_completo)) return true;

  const t = normalizarTextoProposicao(proposicao.texto_completo ?? "");
  // Corpo redigido no editor/DOCX nunca fica vazio; vazio + PDF = upload directo (legado)
  if (!t) return true;

  // Legado: frases curtas que indicam anexo sem corpo redigido no sistema
  if (
    t.length <= 280 &&
    /documento importado|pdf importado|consta do (pdf|documento)|anexo a esta proposi/i.test(t)
  ) {
    return true;
  }

  return false;
}

/**
 * Mostrar o PDF anexado (upload do utilizador), em vez do modelo A4 gerado pelo sistema.
 * Inclui proposições protocoladas com PDF e matérias de inserção manual na pauta com ficheiro.
 */
export function proposicaoDeveExibirPdfAnexado(proposicao: {
  pdf_url?: string | null;
  texto_completo?: string | null;
} | null | undefined): boolean {
  if (!proposicao?.pdf_url?.trim()) return false;
  if (proposicaoTemPdfImportado(proposicao)) return true;
  if (isProposicaoPautaManual(proposicao.texto_completo)) return true;
  return false;
}
