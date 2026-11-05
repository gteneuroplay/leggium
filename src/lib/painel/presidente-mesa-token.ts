import { createHmac, timingSafeEqual } from "node:crypto";

const MESA_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function getAuthSecret(): string | null {
  const s = process.env.AUTH_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

/** Token opaco para o painel da mesa (presidente) sem sessão de utilizador. */
export function signPresidenteMesaToken(sessaoId: string, tenantId: string): string {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET não configurado no servidor.");
  }
  const exp = Date.now() + MESA_TOKEN_TTL_MS;
  const payloadJson = JSON.stringify({ sid: sessaoId, tid: tenantId, exp });
  const sig = createHmac("sha256", secret).update(payloadJson).digest("base64url");
  return Buffer.from(payloadJson, "utf8").toString("base64url") + "." + sig;
}

export function verifyPresidenteMesaToken(token: string): { sessaoId: string; tenantId: string } | null {
  try {
    const secret = getAuthSecret();
    if (!secret) return null;
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!payloadB64 || !sig) return null;
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expectedSig = createHmac("sha256", secret).update(payloadJson).digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(payloadJson) as { sid?: string; tid?: string; exp?: number };
    if (!parsed.sid || !parsed.tid || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return { sessaoId: parsed.sid, tenantId: parsed.tid };
  } catch {
    return null;
  }
}
