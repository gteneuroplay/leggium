import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getMasterPlatformOverview } from "@/app/admin-master/actions";
import { MasterPlatformOverview } from "@/app/admin-master/MasterPlatformOverview";
import { CamarasAdminMasterClient } from "@/app/admin-master/camaras/CamarasAdminMasterClient";
import { getCamarasAdminMaster } from "@/app/admin-master/camaras/actions";

export default async function PlataformaPainelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "ADMIN_MASTER") redirect("/");

  const [overview, camaras] = await Promise.all([
    getMasterPlatformOverview(),
    getCamarasAdminMaster(),
  ]);

  const appBase = process.env.APP_BASE_DOMAIN || "syslegis.com";

  return (
    <div className="flex flex-col gap-12 pb-12">
      <MasterPlatformOverview data={overview} />

      <section id="gestao-camaras" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Domínios, VPS e novas câmaras
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-400">
            Cadastre a câmara, crie o DNS no registrador, use &quot;Preparar site no ar&quot; (valida DNS, Nginx e SSL
            em sequência). Os passos separados ficam recolhidos em &quot;Passos manuais&quot; só para exceções.
            &quot;Abrir dashboard&quot; usa{" "}
            <span className="font-mono text-slate-300">{`slug.${appBase}`}</span>.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 sm:p-6">
          <CamarasAdminMasterClient
            initialData={camaras as any}
            showHeader={false}
            variant="plataforma"
            appBaseDomain={appBase}
          />
        </div>
      </section>
    </div>
  );
}
