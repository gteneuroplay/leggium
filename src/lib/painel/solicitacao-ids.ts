/** IDs temporários no cliente (optimista ou eco SSE) — nunca enviar a server actions que esperam UUID. */
export function isOptimisticPainelSolicitacaoId(id: string | undefined | null): boolean {
  if (!id) return false;
  return id.startsWith("pending:") || id.startsWith("evt:");
}
