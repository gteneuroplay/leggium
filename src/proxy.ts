import { NextResponse, type NextRequest } from "next/server";
import { parseTenantSlugFromHost } from "@/lib/tenant-from-host";
import { safeInternalPath } from "@/lib/auth/safe-redirect";

const AUTH_COOKIE_NAME = "syslegis_session";

/** OPTIONS não envia cookies na maioria dos preflights CORS — tem de responder sem redirect antes do gate de sessão. */
function plataformaTenantPreflightResponse(request: NextRequest) {
  const origin = request.headers.get("origin");
  const reqHeaders = request.headers.get("access-control-request-headers");
  const h = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  });
  if (origin) {
    h.set("Access-Control-Allow-Origin", origin);
  } else {
    h.set("Access-Control-Allow-Origin", "*");
    h.delete("Access-Control-Allow-Credentials");
  }
  if (reqHeaders) {
    h.set("Access-Control-Allow-Headers", reqHeaders);
  }
  return new NextResponse(null, { status: 204, headers: h });
}

function hasValidLikeSession(token?: string) {
  if (!token) return false;
  const [payload] = token.split(".");
  if (!payload) return false;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const parsed = JSON.parse(decoded) as { exp?: number };
    return typeof parsed.exp === "number" && Date.now() <= parsed.exp;
  } catch {
    return false;
  }
}

/** Payload do cookie (base64url). Usar só quando `hasValidLikeSession` já for verdadeiro. */
function decodeSessionPayload(token?: string | null) {
  const [payload] = (token || "").split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as {
      exp?: number;
      role?: string;
      actingTenantId?: string;
    };
  } catch {
    return null;
  }
}

/** Next.js 16+: o ficheiro chama-se `proxy.ts` e exporta `proxy` (antes middleware). */
export async function proxy(request: NextRequest) {
  const baseDomain = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const hostHeader =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "";
  const tenantSlugFromHost = parseTenantSlugFromHost(hostHeader, baseDomain);
  const isPlataformaPath = request.nextUrl.pathname.startsWith("/plataforma");

  if (tenantSlugFromHost && isPlataformaPath && request.method === "OPTIONS") {
    return plataformaTenantPreflightResponse(request);
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = hasValidLikeSession(token);

  // Ficheiros públicos — /public (ícones PWA, uploads, etc.)
  if (request.nextUrl.pathname.startsWith("/downloads/")) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/uploads/")) {
    return NextResponse.next();
  }
  if (
    request.nextUrl.pathname === "/manifest.webmanifest" ||
    request.nextUrl.pathname === "/sw.js" ||
    request.nextUrl.pathname === "/favicon.png" ||
    request.nextUrl.pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  // Basic route protection
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isSetupPage = request.nextUrl.pathname.startsWith("/setup");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isRootPath = request.nextUrl.pathname === "/";
  const isPublicPresidenteMesa =
    request.nextUrl.pathname === "/painel/presidente/mesa" ||
    request.nextUrl.pathname.startsWith("/painel/presidente/mesa/");
  const isPublicObsOverlay =
    request.nextUrl.pathname === "/obs/overlay/oratoria" ||
    request.nextUrl.pathname.startsWith("/obs/overlay/oratoria/") ||
    request.nextUrl.pathname === "/obs/overlay/brasao" ||
    request.nextUrl.pathname.startsWith("/obs/overlay/brasao/");

  /** Apex / www (sem slug de câmara): landing pública em `/` sem sessão. */
  if (!session && isRootPath && tenantSlugFromHost === null) {
    return NextResponse.next();
  }

  if (!session && !isAuthPage && !isSetupPage && !isApiRoute) {
    if (isPublicPresidenteMesa || isPublicObsOverlay) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (returnPath && returnPath !== "/login") {
      url.searchParams.set("next", returnPath);
    }
    return NextResponse.redirect(url);
  }

  if (session && isAuthPage) {
    const next = safeInternalPath(request.nextUrl.searchParams.get("next"));
    if (next) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    const url = request.nextUrl.clone();
    const payload = decodeSessionPayload(token);
    url.pathname =
      payload?.role === "ADMIN_MASTER"
        ? tenantSlugFromHost
          ? "/"
          : "/plataforma"
        : "/";
    return NextResponse.redirect(url);
  }

  if (session) {
    const payload = decodeSessionPayload(token);
    const acting = payload?.actingTenantId?.trim();
    const isMasterSemInstalacao = payload?.role === "ADMIN_MASTER" && !acting;

    // /plataforma no subdomínio fica no mesmo host que o resto da app (RSC same-origin).
    // O layout da rota já restringe a ADMIN_MASTER; outros perfis são redirecionados em /plataforma.

    if (
      isMasterSemInstalacao &&
      !tenantSlugFromHost &&
      !isPlataformaPath &&
      !isAuthPage &&
      !isSetupPage &&
      !isApiRoute
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/plataforma";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next({ request });
  /** Reduz HTML/SPA antigo em cache após deploy (Server Action IDs desalinhados). */
  if (request.nextUrl.pathname.startsWith("/painel")) {
    res.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, max-age=0, must-revalidate",
    );
  }
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk|webmanifest)$).*)",
  ],
};
