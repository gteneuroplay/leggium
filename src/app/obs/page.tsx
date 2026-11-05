import { redirect } from "next/navigation";
import { Video } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardObsPanel } from "@/components/dashboard/DashboardObsPanel";
import { getSessoes } from "@/app/sessoes/actions";
import { getCurrentUser } from "@/lib/dal";
import { canAccessObsTab } from "@/lib/permissions/obs";
import { mapSessoesForObs, pickDefaultSessaoId } from "@/lib/obs/hub-data";

export const dynamic = "force-dynamic";

export default async function ObsHubPage() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) {
    redirect("/login?next=/obs");
  }

  const role = user.profile.role;
  const permissoes = user.profile.setor?.permissoes as Record<string, unknown> | undefined;
  const allowed =
    role === "ADMIN_MASTER" || role === "DEV" || canAccessObsTab(permissoes);

  if (!allowed) {
    redirect("/");
  }

  const sessoesRaw = await getSessoes();
  const sessoesObs = mapSessoesForObs(sessoesRaw);
  const defaultSessaoId = pickDefaultSessaoId(sessoesRaw);

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Video className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
              Overlays OBS
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Escolha o overlay, copie a URL e cole no OBS como fonte de navegador (fundo transparente).
              Os links de overlay funcionam sem login no subdomínio da câmara; use o mesmo host que a sessão
              (ex. <span className="font-mono text-xs">slug.syslegis.com</span>).
            </p>
          </div>
        </div>
        <DashboardObsPanel sessoes={sessoesObs} defaultSessaoId={defaultSessaoId} />
      </div>
    </AppLayout>
  );
}
