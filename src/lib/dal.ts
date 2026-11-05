import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies, setSessionCookie } from "@/lib/auth/session";
import { parseTenantSlugFromHost } from "@/lib/tenant-from-host";

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session?.userId) return null;

  const userProfile = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      setor: true,
      tenant: true,
      vereador: {
        include: {
          comissoes_membro: {
            select: { comissao_id: true }
          },
          comissoes_presididas: {
            select: { id: true }
          },
          comissoes_relatadas: {
            select: { id: true }
          }
        }
      },
    },
  });

  if (!userProfile) return null;

  const baseDomain = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-host");
  const rawHost = (forwarded?.split(",")[0]?.trim() || hdrs.get("host") || "")
    .split(":")[0]
    .toLowerCase();
  const slugFromHost = parseTenantSlugFromHost(rawHost, baseDomain);

  const tenantFromHost =
    slugFromHost == null
      ? null
      : await prisma.tenant.findFirst({
          where: { slug: slugFromHost, deleted_at: null },
        });

  if (slugFromHost && !tenantFromHost) {
    return null;
  }

  const actingFromSession = session.actingTenantId;
  let effectiveProfile = userProfile;
  let masterActingTenantId: string | null = null;

  if (tenantFromHost) {
    if (userProfile.role === "ADMIN_MASTER") {
      masterActingTenantId = tenantFromHost.id;
      effectiveProfile = {
        ...userProfile,
        tenant_id: tenantFromHost.id,
        tenant: tenantFromHost,
      } as typeof userProfile;
    } else if (userProfile.tenant_id !== tenantFromHost.id) {
      return null;
    }
  } else if (userProfile.role === "ADMIN_MASTER" && actingFromSession) {
    const tenantAtual = await prisma.tenant.findFirst({
      where: { id: actingFromSession, deleted_at: null },
    });
    if (tenantAtual) {
      masterActingTenantId = actingFromSession;
      effectiveProfile = { ...userProfile, tenant_id: tenantAtual.id, tenant: tenantAtual } as typeof userProfile;
    } else {
      await setSessionCookie(userProfile.id);
    }
  }

  return {
    id: effectiveProfile.id,
    email: effectiveProfile.email,
    profile: effectiveProfile,
    masterActingTenantId,
  };
}
