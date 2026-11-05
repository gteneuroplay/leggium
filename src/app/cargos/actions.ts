"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function getCargos() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return await prisma.cargo.findMany({
    where: { tenant_id: user.profile.tenant_id },
    orderBy: { nome: 'asc' }
  });
}

export async function upsertCargo(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const { id, nome, permissoes } = formData;

  const dataToSave = {
    tenant_id: user.profile.tenant_id,
    nome,
    permissoes,
    updated_at: new Date(),
  };

  if (id) {
    await prisma.cargo.update({
      where: { id, tenant_id: user.profile.tenant_id },
      data: dataToSave
    });
  } else {
    await prisma.cargo.create({
      data: {
        ...dataToSave,
        id: crypto.randomUUID()
      }
    });
  }

  revalidatePath("/cargos");
  revalidatePath("/usuarios");
  return { success: true };
}

export async function deleteCargo(id: string) {
  await prisma.cargo.delete({
    where: { id }
  });
  
  revalidatePath("/cargos");
  return { success: true };
}
