/** Caminho interno seguro para redirect pós-login (evita open redirect). */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/login")) return null;

  try {
    const u = new URL(trimmed, "http://syslegis.local");
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}
