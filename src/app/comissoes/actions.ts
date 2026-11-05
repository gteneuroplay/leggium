"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function getComissoes() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  const comissoes = await prisma.comissao.findMany({
    where: { tenant_id: user.profile.tenant_id },
    include: {
      presidente: {
        select: {
          nome_parlamentar: true,
          foto_url: true
        }
      },
      relator: {
        select: {
          nome_parlamentar: true,
          foto_url: true
        }
      },
      membros: {
        include: {
          vereador: {
            select: {
              id: true,
              nome_parlamentar: true,
              foto_url: true,
              bancada: {
                select: { sigla: true }
              }
            }
          }
        }
      }
    },
    orderBy: { nome: 'asc' }
  });

  return comissoes;
}

export async function upsertComissao(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const { id, nome, sigla, presidente_id, relator_id, membros_ids } = formData;

  const dataToSave = {
    tenant_id: user.profile.tenant_id,
    nome,
    sigla,
    presidente_id,
    relator_id,
    updated_at: new Date(),
  };

  if (id) {
    // Transação para atualizar comissão e membros
    await prisma.$transaction([
      prisma.comissao.update({
        where: { id, tenant_id: user.profile.tenant_id },
        data: dataToSave
      }),
      // Limpa membros antigos
      prisma.comissaoMembro.deleteMany({
        where: { comissao_id: id }
      }),
      // Insere novos membros
      prisma.comissaoMembro.createMany({
        data: membros_ids.map((vId: string) => ({
          comissao_id: id,
          vereador_id: vId
        }))
      })
    ]);
  } else {
    const newId = crypto.randomUUID();
    await prisma.$transaction([
      prisma.comissao.create({
        data: {
          ...dataToSave,
          id: newId
        }
      }),
      prisma.comissaoMembro.createMany({
        data: membros_ids.map((vId: string) => ({
          comissao_id: newId,
          vereador_id: vId
        }))
      })
    ]);
  }

  revalidatePath("/comissoes");
  return { success: true };
}

export async function deleteComissao(id: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  await prisma.comissao.delete({
    where: { id, tenant_id: user.profile.tenant_id }
  });
  
  revalidatePath("/comissoes");
  return { success: true };
}
