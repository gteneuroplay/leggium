import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Painel da plataforma migrou para `/plataforma` (fora da dashboard da câmara). */
export default function AdminMasterRedirectPage() {
  redirect("/plataforma");
}
