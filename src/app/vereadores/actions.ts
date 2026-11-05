"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function getVereadores() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return { vereadores: [], settings: {} };

  const vereadores = await prisma.vereador.findMany({
    where: { tenant_id: user.profile.tenant_id },
    include: {
      bancada: {
        select: { nome: true, sigla: true, logo_url: true }
      },
      user: {
        select: { username: true, email: true }
      }
    },
    orderBy: { nome_parlamentar: 'asc' }
  });

  return {
    vereadores,
    settings: (user.profile.tenant as any)?.settings || {}
  };
}

export async function getBancadas() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return [];

  return await prisma.bancada.findMany({
    where: { tenant_id: user.profile.tenant_id },
    orderBy: { nome: 'asc' }
  });
}

export async function upsertVereador(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const { 
    id, nome_parlamentar, bancada_id, status_mandato, 
    foto_url, cargo_mesa, username, password
  } = formData;

  const vereadorId = id || crypto.randomUUID();

  // 1. Gestão de Conta de Acesso local (Prisma + senha hash)
  let finalUserId = null;
  const emailDomain = (user.profile.tenant as any)?.settings?.email_domain || "syslegis.com";
  const normalizedUsername = (username || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
  const normalizedEmail = normalizedUsername ? `${normalizedUsername}@${emailDomain}` : null;
  const passwordHash = password?.trim() ? await hashPassword(password) : null;

  if (normalizedUsername || password) {
    // Busca se já existe um usuário vinculado ao vereador no Prisma
    const existingUser = await prisma.user.findFirst({
      where: { vereador_id: vereadorId }
    });

    finalUserId = existingUser?.id;

    if (!finalUserId && normalizedEmail) {
      finalUserId = crypto.randomUUID();
    }

    // Salva/Atualiza na tabela users via Prisma
    if (finalUserId) {
      const updateData: any = {
        tenant_id: user.profile.tenant_id,
        nome: nome_parlamentar,
        email: normalizedEmail!,
        username: normalizedUsername,
        role: 'VEREADOR',
        status: true
      };
      if (passwordHash) {
        updateData.senha_hash = passwordHash;
      }

      const createData: any = {
        id: finalUserId,
        tenant_id: user.profile.tenant_id,
        nome: nome_parlamentar,
        email: normalizedEmail!,
        username: normalizedUsername,
        role: 'VEREADOR',
        status: true
      };
      if (passwordHash) {
        createData.senha_hash = passwordHash;
      }

      await prisma.user.upsert({
        where: { id: finalUserId },
        update: updateData,
        create: createData
      });
    }
  }

  // Se for uma edição e não mudamos o usuário, precisamos do user_id atual
  if (!finalUserId && id) {
    const vCurrent = await prisma.vereador.findUnique({
      where: { id },
      select: { user_id: true }
    });
    finalUserId = vCurrent?.user_id;
  }

  if (!finalUserId) {
    throw new Error("Não foi possível identificar o ID do usuário para o vereador.");
  }

  // 2. Dados do Vereador via Prisma
  const vereadorData: any = {
    tenant_id: user.profile.tenant_id,
    user_id: finalUserId,
    nome_parlamentar,
    bancada_id,
    status_mandato: status_mandato ?? true,
    foto_url,
    cargo_mesa: cargo_mesa || 'MEMBRO',
    updated_at: new Date(),
  };

  await prisma.vereador.upsert({
    where: { id: vereadorId },
    update: vereadorData,
    create: {
      ...vereadorData,
      id: vereadorId
    }
  });

  // 3. Atualiza o usuário com o vereador_id (Vínculo bidirecional)
  if (finalUserId) {
    await prisma.user.update({
      where: { id: finalUserId },
      data: { vereador_id: vereadorId }
    });
  }

  revalidatePath("/vereadores");
  return { success: true };
}

export async function deleteVereador(id: string) {
  await prisma.vereador.delete({
    where: { id }
  });

  revalidatePath("/vereadores");
  return { success: true };
}
