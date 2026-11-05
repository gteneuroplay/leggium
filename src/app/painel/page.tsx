import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { normalizeSetorNome } from "@/lib/bootstrap/default-setores";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Redirecionamento baseado no cargo/setor
  const role = user.profile?.role;
  const setorNome = normalizeSetorNome(user.profile?.setor?.nome || "");

  if (role === "ADMIN_MASTER" || role === "DEV" || setorNome === "ADMINISTRADOR") {
    redirect("/painel/presidente");
  } else if (setorNome === "OPERADOR") {
    redirect("/painel/operador");
  } else if (role === "VEREADOR") {
    redirect("/painel/vereador");
  }

  // Fallback para TV ou Vereador como padrão
  redirect("/painel/tv");
}
