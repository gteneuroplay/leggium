import { Prisma } from "@prisma/client";
import { pgPublicColumnExists } from "@/lib/db/pg-column-exists";
import { prisma } from "@/lib/prisma";

let cachedHasPeColumn: boolean | undefined;

/** Coluna `autoria_poder_executivo` aplicada no Postgres (Prisma Client pode estar desatualizado). */
export async function hasProposicaoAutoriaPoderExecutivoColumn(): Promise<boolean> {
  if (cachedHasPeColumn !== undefined) return cachedHasPeColumn;
  cachedHasPeColumn = await pgPublicColumnExists("proposicoes", "autoria_poder_executivo");
  return cachedHasPeColumn;
}

/** IDs de proposições do Poder Executivo no tenant (SQL direto — não depende do Prisma Client). */
export async function proposicaoIdsPoderExecutivo(
  tenantId: string,
  extraAnd?: Prisma.Sql,
): Promise<string[]> {
  if (!(await hasProposicaoAutoriaPoderExecutivoColumn())) return [];
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT id
      FROM proposicoes
      WHERE tenant_id = ${tenantId}::uuid
        AND autoria_poder_executivo = true
        ${extraAnd ?? Prisma.empty}
    `,
  );
  return rows.map((r) => r.id);
}

/** Mescla lista base com proposições PE ausentes (por id), ordenando por created_at desc. */
export async function mergeProposicoesComPoderExecutivo<T extends { id: string; created_at: Date | string }>(
  tenantId: string,
  base: T[],
  fetchByIds: (ids: string[]) => Promise<T[]>,
  extraAnd?: Prisma.Sql,
): Promise<T[]> {
  const peIds = await proposicaoIdsPoderExecutivo(tenantId, extraAnd);
  const missing = peIds.filter((id) => !base.some((p) => p.id === id));
  if (missing.length === 0) return base;
  const extra = (await fetchByIds(missing)).map((row) => ({
    ...row,
    autoria_poder_executivo: true,
  }));
  return [...base, ...extra].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** Persiste flag PE via SQL quando o Client ainda não expõe o campo. */
export async function setProposicaoAutoriaPoderExecutivo(proposicaoId: string, value: boolean): Promise<void> {
  if (!(await hasProposicaoAutoriaPoderExecutivoColumn())) return;
  await prisma.$executeRaw`
    UPDATE proposicoes SET autoria_poder_executivo = ${value}
    WHERE id = ${proposicaoId}::uuid
  `;
}

export async function getProposicaoAutoriaPoderExecutivo(proposicaoId: string): Promise<boolean> {
  if (!(await hasProposicaoAutoriaPoderExecutivoColumn())) return false;
  const rows = await prisma.$queryRaw<Array<{ autoria_poder_executivo: boolean }>>`
    SELECT autoria_poder_executivo FROM proposicoes WHERE id = ${proposicaoId}::uuid LIMIT 1
  `;
  return Boolean(rows[0]?.autoria_poder_executivo);
}
