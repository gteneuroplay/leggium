/**
 * Permissão «obs» nos setores (Setores / OBS / Transmissão).
 * Retrocompatível: se `obs` não existir no JSON, usa `dashboard`.
 */
export function canAccessObsTab(permissoes: Record<string, unknown> | null | undefined): boolean {
  const p = (permissoes || {}) as Record<string, boolean | undefined>;
  if (p.obs === false) return false;
  if (p.obs === true) return true;
  return p.dashboard === true;
}

export function hasDashboardTabAccess(permissoes: Record<string, unknown> | null | undefined): boolean {
  const p = (permissoes || {}) as Record<string, boolean | undefined>;
  return p.dashboard === true;
}

/**
 * Conta com marcação explícita «OBS / Transmissão» no cargo — após login vai para /obs (hub de overlays).
 */
export function prefersObsHubAsHome(
  role: string | undefined,
  permissoes: Record<string, unknown> | null | undefined,
): boolean {
  if (role === "ADMIN_MASTER" || role === "DEV") return false;
  const p = (permissoes || {}) as Record<string, boolean | undefined>;
  return p.obs === true;
}
