"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function getUsuarios() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  const usuarios = await prisma.user.findMany({
    where: {
      tenant_id: user.profile.tenant_id,
      NOT: {
        role: {
          in: ['ADMIN_MASTER', 'DEV'] as any
        }
      }
    },
    include: {
      setor: {
        select: {
          nome: true,
          permissoes: true
        }
      }
    },
    orderBy: {
      nome: 'asc'
    }
  });

  return usuarios;
}

export async function upsertUsuario(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const { id, nome, email, username, password, role, setor_id, status } = formData;

  // Trava de segurança: impede criação/edição para ADMIN_MASTER ou DEV
  if (role === "ADMIN_MASTER" || role === "DEV") {
    throw new Error("Não é permitido criar ou atribuir o cargo de Admin Master ou Desenvolvedor.");
  }

  const finalUserId = id || crypto.randomUUID();
  const passwordHash = password?.trim() ? await hashPassword(password) : null;

  const dataToSave: any = {
    id: finalUserId,
    tenant_id: user.profile.tenant_id,
    nome,
    email: email || `${username}@syslegis.local`,
    username: username || null,
    role: role as any,
    setor_id: setor_id || null,
    status: status ?? true,
    updated_at: new Date()
  };

  if (passwordHash) {
    dataToSave.senha_hash = passwordHash;
  }

  if (!id && !passwordHash) {
    throw new Error("Informe uma senha para criar o usuário.");
  }

  await prisma.user.upsert({
    where: { id: finalUserId },
    update: dataToSave,
    create: dataToSave
  });

  revalidatePath("/usuarios");
  return { success: true };
}

export async function deleteUsuario(id: string) {
  await prisma.user.delete({
    where: { id }
  });

  revalidatePath("/usuarios");
  return { success: true };
}
