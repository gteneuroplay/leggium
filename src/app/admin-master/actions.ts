"use server";

import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export type MasterPlatformOverview = {
  camaraCount: number;
  userCount: number;
  vereadorCount: number;
  sessaoCount: number;
  proposicaoCount: number;
  ufsAtivas: number;
  cidadesAtivas: number;
  byUf: { uf: string; count: number }[];
  byCity: { cidade: string; uf: string; count: number }[];
  tenants: {
    id: string;
    nome_camara: string;
    slug: string;
    cidade: string;
    uf: string;
    status: boolean | null;
    created_at: Date;
  }[];
};

export async function getMasterPlatformOverview(): Promise<MasterPlatformOverview> {
  const user = await getCurrentUser();
  if (!user?.profile?.role || user.profile.role !== "ADMIN_MASTER") {
    throw new Error("Acesso restrito ao Admin Master.");
  }

  const tenantWhere: Prisma.TenantWhereInput = { deleted_at: null };

  const [
    camaraCount,
    userCount,
    vereadorCount,
    sessaoCount,
    proposicaoCount,
    byUf,
    byCity,
    tenants,
  ] = await Promise.all([
    prisma.tenant.count({ where: tenantWhere }),
    prisma.user.count({ where: { deleted_at: null } }),
    prisma.vereador.count({ where: { deleted_at: null } }),
    prisma.sessao.count({ where: { deleted_at: null } }),
    prisma.proposicao.count({ where: { deleted_at: null } }),
    prisma.tenant.groupBy({
      by: ["uf"],
      where: tenantWhere,
      _count: { id: true },
    }),
    prisma.tenant.groupBy({
      by: ["cidade", "uf"],
      where: tenantWhere,
      _count: { id: true },
    }),
    prisma.tenant.findMany({
      where: tenantWhere,
      orderBy: { nome_camara: "asc" },
      select: {
        id: true,
        nome_camara: true,
        slug: true,
        cidade: true,
        uf: true,
        status: true,
        created_at: true,
      },
    }),
  ]);

  return {
    camaraCount,
    userCount,
    vereadorCount,
    sessaoCount,
    proposicaoCount,
    ufsAtivas: byUf.length,
    cidadesAtivas: byCity.length,
    byUf: [...byUf]
      .map((r) => ({ uf: r.uf, count: r._count.id }))
      .sort((a, b) => b.count - a.count || a.uf.localeCompare(b.uf)),
    byCity: [...byCity]
      .map((r) => ({ cidade: r.cidade, uf: r.uf, count: r._count.id }))
      .sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR") || a.uf.localeCompare(b.uf)),
    tenants,
  };
}
