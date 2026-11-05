import { safeInternalPath } from "@/lib/auth/safe-redirect";
import { prefersObsHubAsHome } from "@/lib/permissions/obs";

export function resolvePostLoginPath(opts: {
  role: string;
  permissoes?: Record<string, unknown> | null;
  slugFromHost: string | null;
  nextPath?: string | null;
}): string {
  const fromNext = safeInternalPath(opts.nextPath);
  if (fromNext) return fromNext;

  if (opts.role === "ADMIN_MASTER") {
    return opts.slugFromHost ? "/" : "/plataforma";
  }

  if (prefersObsHubAsHome(opts.role, opts.permissoes)) {
    return "/obs";
  }

  return "/";
}
