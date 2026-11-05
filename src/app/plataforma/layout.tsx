import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/components/auth/actions";
import { LayoutGrid, LogOut, ExternalLink } from "lucide-react";

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "ADMIN_MASTER") redirect("/");

  const nomeCamaraContexto = user.profile?.tenant?.nome_camara;
  const emInstalacao = Boolean(user.masterActingTenantId);
  const appBase = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const apex = appBase.replace(/^www\./i, "");
  const slugContexto = user.profile?.tenant?.slug;
  const dashboardCamaraUrl =
    emInstalacao && slugContexto ? `https://${slugContexto}.${apex}/` : "/";

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="flex-shrink-0 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg">
              <LayoutGrid className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300/90">
                Fora da dashboard da câmara
              </p>
              <h1 className="text-lg font-black tracking-tight text-white">SysLegis — Painel da plataforma</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {emInstalacao ? (
              <a
                href={dashboardCamaraUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Abrir dashboard: {nomeCamaraContexto}
              </a>
            ) : null}
            <span className="hidden text-xs font-bold text-slate-400 sm:inline">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-white/10"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
