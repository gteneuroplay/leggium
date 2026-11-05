import {
  corpoTextoDocumentoImportado,
  textoEhDocumentoImportado,
} from "@/lib/proposicao-arquivo";
import {
  isProposicaoPautaManual,
  PAUTA_MANUAL_MARKER,
} from "@/lib/pauta/pauta-manual";

export type ProposicaoPainelLeitura = {
  ementa?: string | null;
  texto_completo?: string | null;
  pdf_url?: string | null;
  tipo?: string | null;
  numero?: number | null;
  ano?: number | null;
  autor?: { nome_parlamentar?: string | null } | null;
};

function textoSemMarcadoresInternos(texto: string | null | undefined): string {
  let t = (texto ?? "").trim();
  if (isProposicaoPautaManual(t)) {
    t = t.replace(PAUTA_MANUAL_MARKER, "").trim();
  }
  if (textoEhDocumentoImportado(t)) {
    return corpoTextoDocumentoImportado(t);
  }
  return t;
}

/** Texto para a fase de discussão/leitura no painel do vereador (sem PDF). */
export function textoLeituraDiscussaoPainel(
  proposicao: ProposicaoPainelLeitura | null | undefined,
): string {
  if (!proposicao) return "";
  const ementa = (proposicao.ementa ?? "").trim();
  const corpo = textoSemMarcadoresInternos(proposicao.texto_completo);
  return corpo || ementa;
}

/** Texto redigido no sistema (IA/editor), útil quando há PDF gerado em paralelo. */
export function textoAlternativoSistemaPainel(
  proposicao: ProposicaoPainelLeitura | null | undefined,
): string {
  if (!proposicao) return "";
  const ementa = (proposicao.ementa ?? "").trim();
  const corpo = textoSemMarcadoresInternos(proposicao.texto_completo);
  if (!corpo) return "";
  if (corpo === ementa) return "";
  return corpo;
}

export function proposicaoTemPdfNoPainel(
  proposicao: ProposicaoPainelLeitura | null | undefined,
): boolean {
  return !!proposicao?.pdf_url?.trim();
}
