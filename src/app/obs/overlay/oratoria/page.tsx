import { getPainelObsData } from "@/app/obs/actions";
import { resolveTenantForObsPublicAccess } from "@/lib/obs/public-tenant";
import { ObsOratoriaOverlayClient } from "./ObsOratoriaOverlayClient";

export const dynamic = "force-dynamic";

export default async function ObsOratoriaOverlayPage({
  searchParams,
}: {
  searchParams: Promise<{ sessaoId?: string }>;
}) {
  const { sessaoId } = await searchParams;
  if (!sessaoId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-sm text-slate-300">
        Parâmetro <code className="text-blue-300">sessaoId</code> é obrigatório na URL.
      </div>
    );
  }

  const scope = await resolveTenantForObsPublicAccess(sessaoId);
  if (!scope) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-sm text-red-300">
        Sessão não encontrada ou URL deve ser aberta no subdomínio da câmara (ex.{" "}
        <span className="font-mono text-red-200">slug.syslegis.com</span>).
      </div>
    );
  }

  let initialData;
  try {
    initialData = await getPainelObsData(sessaoId);
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-sm text-red-300">
        Não foi possível carregar os dados da sessão.
      </div>
    );
  }

  return <ObsOratoriaOverlayClient sessaoId={sessaoId} initialData={initialData} />;
}
