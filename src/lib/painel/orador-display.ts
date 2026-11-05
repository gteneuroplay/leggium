/** Exibição unificada: fila de palavra pode ser vereador ou orador externo (visitante). */

function createdAtMs(s: { created_at?: string | Date | null } | null | undefined): number {
  if (!s?.created_at) return 0;
  const t = new Date(s.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Ordenação estável da fila (optimista/SSE pode omitir `created_at`). */
export function compareSolicitacaoCreatedAsc(a: unknown, b: unknown): number {
  return createdAtMs(a as { created_at?: string | Date | null }) - createdAtMs(b as { created_at?: string | Date | null });
}

export function compareSolicitacaoCreatedDesc(a: unknown, b: unknown): number {
  return createdAtMs(b as { created_at?: string | Date | null }) - createdAtMs(a as { created_at?: string | Date | null });
}

/** Único orador em fala (mais recente se houver inconsistência de dados). */
export function pickOradorEmFala(solicitacoes: unknown[] | null | undefined): any {
  if (!Array.isArray(solicitacoes)) return undefined;
  const emFala = solicitacoes.filter(
    (s) => String((s as { status?: string }).status ?? "").toUpperCase() === "EM_FALA",
  );
  if (!emFala.length) return undefined;
  return [...emFala].sort(
    (a, b) => createdAtMs(b as { created_at?: string | Date | null }) - createdAtMs(a as { created_at?: string | Date | null }),
  )[0];
}

export function nomeOradorSolicitacao(sol?: {
  vereador?: { nome_parlamentar?: string | null } | null;
  visitante?: { nome_completo?: string | null } | null;
} | null) {
  if (!sol) return "Orador";
  const n = sol.visitante?.nome_completo?.trim() || sol.vereador?.nome_parlamentar?.trim();
  return n || "Orador";
}

export function iniciaisOradorSolicitacao(sol?: {
  vereador?: { nome_parlamentar?: string | null } | null;
  visitante?: { nome_completo?: string | null } | null;
} | null) {
  const n = nomeOradorSolicitacao(sol);
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase() || "?";
}

/** Cargo / representação para telão (visitante: representação; vereador: cargo na mesa). */
export function cargoOradorSolicitacao(
  sol: {
    vereador_id?: string | null;
    visitante?: { representacao?: string | null } | null;
    vereador?: { cargo_mesa?: string | null } | null;
  } | null | undefined,
  vereadores: Array<{ id: string; cargo_mesa?: string | null }>,
): string {
  if (!sol) return "";
  const repVisitante = sol.visitante?.representacao?.trim();
  if (repVisitante) return repVisitante;
  const cargoEmbutido = sol.vereador?.cargo_mesa?.trim();
  if (cargoEmbutido) return cargoEmbutido;
  const vid = sol.vereador_id;
  if (vid) {
    const cargoLista = vereadores.find((v) => v.id === vid)?.cargo_mesa?.trim();
    if (cargoLista) return cargoLista;
  }
  return "";
}

export function fotoOradorSolicitacao(
  sol: {
    vereador_id?: string | null;
    visitante?: { foto_url?: string | null } | null;
    vereador?: { foto_url?: string | null } | null;
  } | null | undefined,
  vereadores: Array<{ id: string; foto_url?: string | null }>,
  fallback = "/placeholder-user.jpg"
) {
  if (!sol) return fallback;
  const vFoto = sol.visitante?.foto_url;
  if (vFoto) return vFoto;
  const inc = sol.vereador?.foto_url;
  if (inc) return inc;
  const vid = sol.vereador_id;
  if (vid) {
    const fromList = vereadores.find((v) => v.id === vid)?.foto_url;
    if (fromList) return fromList;
  }
  return fallback;
}

/** Vereador em fala com cargo de presidente da mesa: sem limite de tempo de oratória. */
export function isOradorPresidenteMesa(sol: unknown): boolean {
  if (!sol || typeof sol !== "object") return false;
  const s = sol as {
    visitante_id?: string | null;
    vereador_id?: string | null;
    vereador?: { cargo_mesa?: string | null } | null;
  };
  if (s.visitante_id) return false;
  const cargo = String(s.vereador?.cargo_mesa ?? "").trim().toUpperCase();
  return Boolean(s.vereador_id) && cargo === "PRESIDENTE";
}
