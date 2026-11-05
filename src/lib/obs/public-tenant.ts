import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseTenantSlugFromHost } from "@/lib/tenant-from-host";

async function requestHost(): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-host");
  return (forwarded?.split(",")[0]?.trim() || hdrs.get("host") || "")
    .split(":")[0]
    .toLowerCase();
}

/**
 * Resolve o tenant para overlays OBS sem login.
 * Com subdomínio da câmara, exige que a sessão (se informada) pertença a esse tenant.
 */
export async function resolveTenantForObsPublicAccess(sessaoId?: string | null): Promise<{
  tenantId: string;
  slug: string;
  nome_camara: string;
  brasao_url: string | null;
} | null> {
  const baseDomain = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const host = await requestHost();
  const slugFromHost = parseTenantSlugFromHost(host, baseDomain);

  let tenantFromHost: {
    id: string;
    slug: string;
    nome_camara: string;
    brasao_url: string | null;
  } | null = null;

  if (slugFromHost) {
    tenantFromHost = await prisma.tenant.findFirst({
      where: { slug: slugFromHost, deleted_at: null },
      select: {
        id: true,
        slug: true,
        nome_camara: true,
        brasao_url: true,
      },
    });
    if (!tenantFromHost) return null;
  }

  if (sessaoId?.trim()) {
    const sessao = await prisma.sessao.findFirst({
      where: { id: sessaoId.trim(), deleted_at: null },
      select: {
        tenant_id: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            nome_camara: true,
            brasao_url: true,
          },
        },
      },
    });
    if (!sessao?.tenant) return null;
    if (tenantFromHost && tenantFromHost.id !== sessao.tenant_id) {
      return null;
    }
    return {
      tenantId: sessao.tenant.id,
      slug: sessao.tenant.slug,
      nome_camara: sessao.tenant.nome_camara,
      brasao_url: sessao.tenant.brasao_url,
    };
  }

  if (!tenantFromHost) return null;

  return {
    tenantId: tenantFromHost.id,
    slug: tenantFromHost.slug,
    nome_camara: tenantFromHost.nome_camara,
    brasao_url: tenantFromHost.brasao_url,
  };
}
