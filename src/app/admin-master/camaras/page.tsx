import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";

/** Rota legada: painel unificado em `/admin-master`. */
export default async function AdminMasterCamarasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "ADMIN_MASTER") redirect("/");
  redirect("/plataforma#gestao-camaras");
}
