/**
 * Quando o bundle JS do cliente fica desalinhado do servidor (deploy, cache agressivo),
 * as Server Actions do Next devolvem erros do tipo "was not found on the server".
 * Recarregar a página obtém o manifest e os action IDs corretos.
 */
const RELOAD_COOLDOWN_MS = 20_000;
const SESSION_TS_KEY = "__syslegis_stale_sa_reload_ts";

export function isStaleClientServerActionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    /Failed to find Server Action/i.test(msg) ||
    /UnrecognizedActionError/i.test(msg) ||
    /was not found on the server/i.test(msg) ||
    /SERVER_ACTION_NOT_FOUND/i.test(msg)
  );
}

/** Devolve true se iniciou recarga (não mostrar toast genérico). */
export function reloadOnceIfStaleClientServerAction(error: unknown): boolean {
  if (!isStaleClientServerActionError(error) || typeof window === "undefined") {
    return false;
  }
  try {
    const raw = sessionStorage.getItem(SESSION_TS_KEY);
    const last = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(last) && last > 0 && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(SESSION_TS_KEY, String(Date.now()));
  } catch {
    /* sessionStorage indisponível — ainda tentamos recarregar */
  }
  window.location.reload();
  return true;
}
