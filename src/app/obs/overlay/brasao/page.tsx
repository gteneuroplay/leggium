import { resolveTenantForObsPublicAccess } from "@/lib/obs/public-tenant";
import { ObsBrasaoOverlayClient } from "./ObsBrasaoOverlayClient";

export const dynamic = "force-dynamic";

export default async function ObsBrasaoOverlayPage() {
  const scope = await resolveTenantForObsPublicAccess();
  if (!scope) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-sm text-red-300">
        Abra este overlay no subdomínio da câmara (ex.{" "}
        <span className="font-mono text-red-200">slug.syslegis.com/obs/overlay/brasao</span>).
      </div>
    );
  }

  return (
    <ObsBrasaoOverlayClient
      brasaoUrl={scope.brasao_url}
      nomeCamara={scope.nome_camara ?? "Câmara Municipal"}
    />
  );
}
