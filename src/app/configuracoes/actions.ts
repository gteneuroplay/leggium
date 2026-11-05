"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function getTenantConfig() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) return null;

  const [tenant, tiposProposicao] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: user.profile.tenant_id }
    }),
    prisma.proposicaoTipo.findMany({
      where: { tenant_id: user.profile.tenant_id },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true }
    })
  ]);

  if (!tenant) return null;
  return {
    ...tenant,
    tiposProposicao
  };
}

export async function updateTenantConfig(formData: any) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  await prisma.tenant.update({
    where: { id: user.profile.tenant_id },
    data: {
      nome_camara: formData.nome_camara,
      brasao_url: formData.brasao_url,
      gemini_api_key: formData.gemini_api_key,
      settings: formData.settings, // Salvando o JSONB de configurações
      updated_at: new Date()
    }
  });

  revalidatePath("/configuracoes");
  revalidatePath("/proposicoes"); // Revalidar proposições para o novo timbre
  return { success: true };
}

export async function uploadBrasao(file: FormData) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const actualFile = file.get("file") as File;
  if (!actualFile) throw new Error("Arquivo não enviado.");
  const fileExt = actualFile.name.split(".").pop();
  const fileName = `brasao-${user.profile.tenant_id}-${Date.now()}.${fileExt || "png"}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, fileName);
  const arrayBuffer = await actualFile.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));
  return `/uploads/${fileName}`;
}
