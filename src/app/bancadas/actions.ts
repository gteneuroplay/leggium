"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function getBancadas() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  const bancadas = await prisma.bancada.findMany({
    where: { tenant_id: user.profile.tenant_id },
    include: {
      vereadores: {
        select: {
          nome_parlamentar: true,
          foto_url: true,
          cargo_mesa: true
        }
      }
    },
    orderBy: { nome: 'asc' }
  });

  // Ordena por maior número de vereadores
  const sortedData = bancadas.sort((a, b) => (b.vereadores?.length || 0) - (a.vereadores?.length || 0));

  return sortedData;
}

export async function upsertBancada(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const { id, nome, sigla, logo_url } = formData;

  const dataToSave = {
    tenant_id: user.profile.tenant_id,
    nome,
    sigla,
    logo_url,
    updated_at: new Date(),
  };

  if (id) {
    await prisma.bancada.update({
      where: { id, tenant_id: user.profile.tenant_id },
      data: dataToSave
    });
  } else {
    await prisma.bancada.create({
      data: {
        ...dataToSave,
        id: crypto.randomUUID()
      }
    });
  }

  revalidatePath("/bancadas");
  revalidatePath("/vereadores");
  return { success: true };
}

export async function deleteBancada(id: string) {
  await prisma.bancada.delete({
    where: { id }
  });
  
  revalidatePath("/bancadas");
  revalidatePath("/vereadores");
  return { success: true };
}
