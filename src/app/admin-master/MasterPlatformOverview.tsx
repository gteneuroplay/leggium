import Link from "next/link";
import {
  Building2,
  MapPin,
  Flag,
  Users,
  Gavel,
  CalendarDays,
  FileText,
  ArrowDownRight,
} from "lucide-react";
import type { MasterPlatformOverview } from "./actions";

export function MasterPlatformOverview({ data }: { data: MasterPlatformOverview }) {
  const kpis = [
    {
      name: "Câmaras ativas",
      value: data.camaraCount,
      icon: Building2,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-600/10",
      border: "border-blue-600/20",
    },
    {
      name: "Cidades com instalação",
      value: data.cidadesAtivas,
      icon: MapPin,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-600/10",
      border: "border-violet-600/20",
    },
    {
      name: "Estados (UF)",
      value: data.ufsAtivas,
      icon: Flag,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-600/10",
      border: "border-amber-600/20",
    },
    {
      name: "Usuários (todas as casas)",
      value: data.userCount,
      icon: Users,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-600/10",
      border: "border-emerald-600/20",
    },
    {
      name: "Vereadores",
      value: data.vereadorCount,
      icon: Gavel,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-600/10",
      border: "border-indigo-600/20",
    },
    {
      name: "Sessões registradas",
      value: data.sessaoCount,
      icon: CalendarDays,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-600/10",
      border: "border-rose-600/20",
    },
    {
      name: "Proposições",
      value: data.proposicaoCount,
      icon: FileText,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-600/10",
      border: "border-cyan-600/20",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-8 md:p-10 text-white shadow-2xl border border-white/10">
        <div className="relative z-10 max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-200/80">
            SysLegis — painel da plataforma
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
            Sua operação multi-câmaras
          </h1>
          <p className="mt-3 text-sm md:text-base text-blue-100/90 font-medium leading-relaxed">
            Visão consolidada das instalações que você administra: quantidade de câmaras, cidades e
            estados onde o sistema está em uso, além dos totais de uso legislativo em toda a base.
          </p>
          <div className="mt-6">
            <Link
              href="/plataforma#gestao-camaras"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-colors"
            >
              <ArrowDownRight className="h-4 w-4" />
              Domínios, VPS e novas câmaras
            </Link>
          </div>
        </div>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />
        <div className="absolute -bottom-20 right-1/4 h-72 w-72 rounded-full bg-violet-500/15 blur-[90px]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
        {kpis.map((item) => (
          <div
            key={item.name}
            className="premium-panel p-6 rounded-xl border border-border shadow-lg hover:border-blue-500/25 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className={`p-3 rounded-xl ${item.bg} ${item.color} border ${item.border}`}>
                <item.icon className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
              {item.name}
            </p>
            <p className="text-3xl font-black text-foreground mt-1 tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="premium-panel rounded-xl border border-border p-6 shadow-lg">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2 mb-4">
            <Flag className="h-5 w-5 text-amber-600" />
            Câmaras por UF
          </h2>
          {data.byUf.length === 0 ? (
            <p className="text-sm text-slate-500 font-medium">Nenhuma câmara cadastrada ainda.</p>
          ) : (
            <ul className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {data.byUf.map((row) => (
                <li
                  key={row.uf}
                  className="flex items-center justify-between rounded-lg border border-border bg-slate-50 dark:bg-white/5 px-3 py-2"
                >
                  <span className="font-bold text-foreground">{row.uf}</span>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    {row.count} {row.count === 1 ? "câmara" : "câmaras"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="premium-panel rounded-xl border border-border p-6 shadow-lg">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-violet-600" />
            Cidades atendidas
          </h2>
          {data.byCity.length === 0 ? (
            <p className="text-sm text-slate-500 font-medium">Nenhuma cidade na base.</p>
          ) : (
            <ul className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {data.byCity.map((row) => (
                <li
                  key={`${row.cidade}-${row.uf}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-slate-50 dark:bg-white/5 px-3 py-2"
                >
                  <span className="font-bold text-foreground">
                    {row.cidade}
                    <span className="text-slate-500 font-semibold"> / {row.uf}</span>
                  </span>
                  {row.count > 1 && (
                    <span className="text-[10px] font-black text-violet-600 uppercase">
                      {row.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="premium-panel rounded-xl border border-border p-6 shadow-lg">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-blue-600" />
          Instalações (lista rápida)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-border">
                <th className="pb-3 pr-4">Câmara</th>
                <th className="pb-3 pr-4">Slug</th>
                <th className="pb-3 pr-4">Local</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-bold text-foreground">{t.nome_camara}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {t.slug}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                    {t.cidade} / {t.uf}
                  </td>
                  <td className="py-3">
                    <span
                      className={
                        t.status !== false
                          ? "text-[10px] font-black uppercase text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md"
                          : "text-[10px] font-black uppercase text-amber-700 bg-amber-500/10 px-2 py-1 rounded-md"
                      }
                    >
                      {t.status !== false ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
