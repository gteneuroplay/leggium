/**
 * Extrai o slug do tenant a partir do Host (ex.: camara-teste.syslegis.com → camara-teste).
 * Retorna null no apex (syslegis.com, www.syslegis.com) ou quando o host não é *.baseDomain.
 */
export function parseTenantSlugFromHost(
  hostHeader: string | null | undefined,
  baseDomain: string
): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(",")[0].trim().split(":")[0].toLowerCase();
  const base = baseDomain.trim().toLowerCase().replace(/^www\./, "");
  if (!host || !base) return null;
  if (host === base || host === `www.${base}`) return null;
  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return null;
  const sub = host.slice(0, -suffix.length);
  if (!sub || sub === "www") return null;
  return sub;
}
