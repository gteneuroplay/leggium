import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Cache por processo: evita consultas repetidas ao catálogo. */
const columnExistsCache = new Map<string, boolean>();

/**
 * Indica se uma coluna existe em `public` (PostgreSQL).
 * Usado quando o Prisma Client pode estar desatualizado em relação ao SQL aplicado no banco.
 */
export async function pgPublicColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(key);
  if (cached !== undefined) return cached;

  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = ${tableName}
        AND c.column_name = ${columnName}
    ) AS "exists"
  `);
  const exists = Boolean(rows[0]?.exists);
  columnExistsCache.set(key, exists);
  return exists;
}
