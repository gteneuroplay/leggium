"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies, setSessionCookie } from "@/lib/auth/session";

/** Master passa a operar no contexto de outra câmara (tenant_id efetivo na sessão). */
export async function entrarNaInstalacaoCamara(tenantId: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.role || user.profile.role !== "ADMIN_MASTER") {
    throw new Error("Acesso restrito ao painel da plataforma.");
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deleted_at: null },
    select: { id: true },
  });
  if (!tenant) throw new Error("Câmara não encontrada ou inativa.");

  await setSessionCookie(user.id, { actingTenantId: tenantId });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Remove o contexto da câmara e volta só ao perfil master (área /plataforma). */
export async function voltarSomentePlataforma() {
  const user = await getCurrentUser();
  if (!user?.profile?.role || user.profile.role !== "ADMIN_MASTER") {
    redirect("/");
  }
  await setSessionCookie(user.id);
  revalidatePath("/", "layout");
  redirect("/plataforma");
}

/** Remove só o actingTenantId (mantém login). Útil antes de abrir o dashboard no subdomínio. */
export async function limparContextoInstalacaoMaster() {
  const session = await getSessionFromCookies();
  if (!session?.userId) return { ok: false as const };
  const row = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (row?.role !== "ADMIN_MASTER") return { ok: false as const };
  await setSessionCookie(session.userId);
  return { ok: true as const };
}
