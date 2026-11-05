"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { parseTenantSlugFromHost } from "@/lib/tenant-from-host";
import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";

export async function login(prevState: any, formData: FormData) {
  const loginInput = formData.get("email") as string;
  const password = formData.get("password") as string;
  
  if (!loginInput || !password) {
    return { error: "Identificação e senha são obrigatórios." };
  }

  const normalizedLogin = loginInput.trim().toLowerCase();
  const isEmailLogin = normalizedLogin.includes("@");
  const fallbackEmailFromUsername = `${normalizedLogin}@syslegis.local`;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        // Login por e-mail real
        ...(isEmailLogin ? [{ email: normalizedLogin }] : []),
        // Login por username
        { username: normalizedLogin },
        // Compatibilidade com legados que transformavam username em e-mail interno
        { email: fallbackEmailFromUsername },
      ],
      deleted_at: null,
      status: true,
    },
    include: { setor: { select: { permissoes: true } } },
  });

  if (!user) {
    return { error: "Usuário ou senha inválidos." };
  }

  const senhaHash = (user as any).senha_hash as string | undefined;
  if (!senhaHash) {
    return { error: "Usuário ou senha inválidos." };
  }

  const passwordMatches = await verifyPassword(password, senhaHash);
  if (!passwordMatches) {
    return { error: "Usuário ou senha inválidos." };
  }

  const baseDomain = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-host");
  const rawHost = (forwarded?.split(",")[0]?.trim() || hdrs.get("host") || "")
    .split(":")[0]
    .toLowerCase();
  const slugFromHost = parseTenantSlugFromHost(rawHost, baseDomain);

  if (slugFromHost) {
    const tenantRow = await prisma.tenant.findFirst({
      where: { slug: slugFromHost, deleted_at: null },
      select: { id: true },
    });
    if (!tenantRow) {
      return { error: "Instalação desta câmara não encontrada." };
    }
    if (user.role !== "ADMIN_MASTER" && user.tenant_id !== tenantRow.id) {
      return { error: "Esta conta não pertence a este endereço da câmara." };
    }
  }

  await setSessionCookie(user.id);
  revalidatePath("/", "layout");

  const nextRaw = String(formData.get("next") ?? "").trim();
  const redirectTo = resolvePostLoginPath({
    role: user.role,
    permissoes: (user.setor?.permissoes ?? null) as Record<string, unknown> | null,
    slugFromHost,
    nextPath: nextRaw || null,
  });

  return { success: true as const, redirect: redirectTo };
}
