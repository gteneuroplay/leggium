/** Marca proposições criadas pelo operador em «Pautas» sem tramitação prévia. */
export const PAUTA_MANUAL_MARKER = "<!--syslegis:pauta-manual-->";

export function isProposicaoPautaManual(textoCompleto?: string | null): boolean {
  return typeof textoCompleto === "string" && textoCompleto.trimStart().startsWith(PAUTA_MANUAL_MARKER);
}

export function textoCompletoPautaManual(complemento?: string | null): string {
  const body = (complemento ?? "").trim();
  return body ? `${PAUTA_MANUAL_MARKER}\n${body}` : PAUTA_MANUAL_MARKER;
}
