import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "syslegis_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export type SessionPayload = {
  userId: string;
  exp: number;
  /** Cache para o proxy (ante rotas): perfil real continua no banco. */
  role?: string;
  /** Admin Master operando o contexto de outra câmara (tenant_id efetivo). */
  actingTenantId?: string;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não configurada no ambiente.");
  }
  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function sessionCookieBaseOptions() {
  const opts: { path: string; domain?: string } = { path: "/" };
  const base = process.env.APP_BASE_DOMAIN?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    base &&
    !base.includes("localhost") &&
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(base)
  ) {
    const apex = base.replace(/^www\./i, "");
    opts.domain = `.${apex}`;
  }
  return opts;
}

export async function setSessionCookie(
  userId: string,
  options?: { actingTenantId?: string | null },
) {
  const cookieStore = await cookies();
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!userRow?.role) {
    throw new Error("Usuário não encontrado para criar sessão.");
  }

  const payload: SessionPayload = {
    userId,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    role: userRow.role,
  };

  if (options?.actingTenantId) {
    payload.actingTenantId = options.actingTenantId;
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  const opts: Parameters<typeof cookieStore.set>[2] = {
    ...sessionCookieBaseOptions(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };

  cookieStore.set(SESSION_COOKIE_NAME, token, opts);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieBaseOptions(),
    maxAge: 0,
  });
}

export function readSessionFromToken(token?: string | null): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!parsed.userId || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return readSessionFromToken(token);
}

export const authCookieName = SESSION_COOKIE_NAME;
