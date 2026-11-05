"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isSystemSetorNome } from "@/lib/bootstrap/default-setores";

export async function getSetores() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return await prisma.setor.findMany({
    where: {
      tenant_id: user.profile.tenant_id,
      deleted_at: null
    },
    orderBy: { nome: 'asc' }
  });
}

export async function upsertSetor(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const { id, nome, sigla, permissoes } = formData;

  // Trava de segurança: impede renomear setores fixos
  if (id) {
    const current = await prisma.setor.findUnique({
      where: { id },
      select: { nome: true }
    });
    const currentName = current?.nome?.toUpperCase();
    if (currentName && isSystemSetorNome(currentName)) {
      if (nome.toUpperCase() !== currentName) {
        throw new Error(`O nome do setor ${currentName} é obrigatório e não pode ser alterado.`);
      }
    }
  }

  const dataToSave = {
    nome,
    sigla,
    permissoes,
    tenant_id: user.profile.tenant_id,
    updated_at: new Date(),
  };

  if (id) {
    await prisma.setor.update({
      where: { id },
      data: dataToSave
    });
  } else {
    await prisma.setor.create({
      data: {
        ...dataToSave,
        id: crypto.randomUUID()
      }
    });
  }

  revalidatePath("/setores");
  revalidatePath("/usuarios");
  return { success: true };
}

export async function deleteSetor(id: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  // Trava de segurança: impede deletar setores fixos
  const current = await prisma.setor.findUnique({
    where: { id },
    select: { nome: true }
  });
  const currentName = current?.nome?.toUpperCase();
  if (currentName && isSystemSetorNome(currentName)) {
    throw new Error(`O setor ${currentName} é obrigatório para o sistema e não pode ser excluído.`);
  }

  // Soft Delete
  await prisma.setor.update({
    where: { id },
    data: { deleted_at: new Date() }
  });

  revalidatePath("/setores");
}
