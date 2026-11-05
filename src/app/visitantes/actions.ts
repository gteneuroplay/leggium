"use server";

import { Prisma } from "@prisma/client";
import { pgPublicColumnExists } from "@/lib/db/pg-column-exists";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";

export async function getVisitantes() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT *
    FROM visitantes
    WHERE tenant_id = ${user.profile.tenant_id}::uuid
    ORDER BY created_at DESC
  `);
}

export async function upsertVisitante(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const {
    id,
    nome_completo,
    representacao,
    motivo_visita,
    vereador_id,
    foto_url,
    disponivel_tribuna,
  } = formData;

  const fotoVal = typeof foto_url === "string" && foto_url.trim() ? foto_url.trim() : null;
  const tribunaVal = Boolean(disponivel_tribuna);

  const dataPrisma = {
    tenant_id: user.profile.tenant_id,
    nome_completo,
    representacao,
    motivo_visita,
    gabinete_destino_id: vereador_id || null,
    updated_at: new Date(),
  };

  const hasFotoCol = await pgPublicColumnExists("visitantes", "foto_url");
  const hasTribunaCol = await pgPublicColumnExists("visitantes", "disponivel_tribuna");
  const canPersistTribunaFoto = hasFotoCol && hasTribunaCol;

  if (id) {
    await prisma.visitante.update({
      where: {
        id,
        tenant_id: user.profile.tenant_id,
      },
      data: dataPrisma,
    });
    if (canPersistTribunaFoto) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE visitantes
        SET foto_url = ${fotoVal}, disponivel_tribuna = ${tribunaVal}, updated_at = NOW()
        WHERE id = ${id}::uuid AND tenant_id = ${user.profile.tenant_id}::uuid
      `);
    }
  } else {
    const newId = crypto.randomUUID();
    await prisma.visitante.create({
      data: {
        ...dataPrisma,
        id: newId,
      },
    });
    if (canPersistTribunaFoto) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE visitantes
        SET foto_url = ${fotoVal}, disponivel_tribuna = ${tribunaVal}, updated_at = NOW()
        WHERE id = ${newId}::uuid AND tenant_id = ${user.profile.tenant_id}::uuid
      `);
    }
  }


  revalidatePath("/visitantes");
  revalidatePath("/painel");
  revalidatePath("/painel/operador");
  return { success: true };
}

export async function deleteVisitante(id: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  await prisma.visitante.delete({
    where: { 
      id,
      tenant_id: user.profile.tenant_id
    }
  });

  revalidatePath("/visitantes");
  revalidatePath("/painel");
  revalidatePath("/painel/operador");
}

