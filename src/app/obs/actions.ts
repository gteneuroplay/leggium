"use server";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getPainelData, getPainelDataForTenantPublic } from "@/app/painel/actions";
import { resolveTenantForObsPublicAccess } from "@/lib/obs/public-tenant";

async function loadPainelObsBundle(sessaoId: string, tenantId: string) {
  const [painel, vereadores] = await Promise.all([
    getPainelDataForTenantPublic(tenantId, sessaoId),
    prisma.vereador.findMany({
      where: { tenant_id: tenantId, deleted_at: null },
      orderBy: { nome_parlamentar: "asc" },
      include: {
        bancada: { select: { sigla: true, nome: true } },
      },
    }),
  ]);

  const vereadoresFlat = vereadores.map((v: any) => ({
    ...v,
    partido: v.bancada?.sigla ?? "",
  }));

  return {
    ...painel,
    vereadores: vereadoresFlat,
  };
}

/** Dados do painel + vereadores com bancada (sigla do partido) para overlays OBS. */
export async function getPainelObsData(sessaoId: string) {
  const user = await getCurrentUser();
  if (user?.profile?.tenant_id) {
    const ok = await prisma.sessao.findFirst({
      where: { id: sessaoId, tenant_id: user.profile.tenant_id, deleted_at: null },
      select: { id: true },
    });
    if (!ok) throw new Error("Sessão não encontrada ou sem permissão.");
    const painel = await getPainelData(sessaoId);
    const vereadores = await prisma.vereador.findMany({
      where: { tenant_id: user.profile.tenant_id, deleted_at: null },
      orderBy: { nome_parlamentar: "asc" },
      include: {
        bancada: { select: { sigla: true, nome: true } },
      },
    });
    const vereadoresFlat = vereadores.map((v: any) => ({
      ...v,
      partido: v.bancada?.sigla ?? "",
    }));
    return { ...painel, vereadores: vereadoresFlat };
  }

  const scope = await resolveTenantForObsPublicAccess(sessaoId);
  if (!scope) {
    throw new Error("Não autorizado");
  }
  return loadPainelObsBundle(sessaoId, scope.tenantId);
}
