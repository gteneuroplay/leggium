import type { ComponentType } from "react";
import Link from "next/link";
import {
  Users,
  DoorOpen,
  ArrowUpRight,
  Calendar,
  FileText,
  Clock,
  HandMetal,
} from "lucide-react";
import { InstitutionalAvatar } from "@/components/ui/InstitutionalAvatar";

type StatTint = "primary" | "gold" | "success" | "info";

const STAT_TINTS: Record<
  StatTint,
  { bg: string; color: string; border: string }
> = {
  primary: {
    bg: "var(--sl-primary-bg)",
    color: "var(--sl-primary-hi)",
    border: "oklch(0.62 0.135 252 / 0.3)",
  },
  gold: {
    bg: "var(--sl-gold-bg)",
    color: "var(--sl-gold)",
    border: "oklch(0.80 0.095 86 / 0.3)",
  },
  success: {
    bg: "var(--sl-success-bg)",
    color: "var(--sl-success)",
    border: "oklch(0.74 0.125 160 / 0.3)",
  },
  info: {
    bg: "var(--sl-info-bg)",
    color: "var(--sl-info)",
    border: "oklch(0.70 0.10 232 / 0.3)",
  },
};

function StatCard({
  icon: Icon,
  tint,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  tint: StatTint;
  label: string;
  value: number;
}) {
  const t = STAT_TINTS[tint];
  return (
    <div className="sl-card sl-card-hover flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div
          className="grid h-[46px] w-[46px] place-items-center rounded-[var(--sl-r)] border"
          style={{ background: t.bg, color: t.color, borderColor: t.border }}
        >
          <Icon className="h-[22px] w-[22px]" />
        </div>
        <ArrowUpRight className="h-[18px] w-[18px] text-[var(--sl-faint)]" />
      </div>
      <div>
        <p className="sl-stat-lbl">{label}</p>
        <p className="sl-stat-val mt-2">{value}</p>
      </div>
    </div>
  );
}

export function DashboardOverview({
  userFirstName,
  welcomeLead,
  tenantName,
  stats,
  dbStatsType,
  adminData,
}: {
  userFirstName: string;
  welcomeLead: string;
  tenantName?: string;
  stats: Array<{
    name: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
    tint: StatTint;
  }>;
  dbStatsType: string | undefined;
  adminData: {
    visitantes?: any[];
    convites?: any[];
  };
}) {
  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Banner institucional */}
      <div
        className="sl-card relative overflow-hidden p-6 sm:p-8 md:p-10"
        style={{
          background:
            "linear-gradient(120deg, oklch(0.26 0.05 252), oklch(0.21 0.025 256) 65%)",
          borderColor: "oklch(0.62 0.135 252 / 0.3)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(700px 300px at 88% -20%, oklch(0.62 0.135 252 / 0.25), transparent)",
          }}
        />
        <div className="relative max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-[var(--sl-gold)]">
            <HandMetal className="h-5 w-5" />
            <span className="sl-kicker text-[var(--sl-gold)]">Bem-vindo</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--sl-text)] sm:text-3xl md:text-4xl">
            Olá, {userFirstName}.
          </h1>
          <p className="mt-3 max-w-2xl text-[0.96rem] leading-relaxed text-[var(--sl-text-2)]">
            {tenantName && welcomeLead.includes(tenantName) ? (
              <>
                {welcomeLead.split(tenantName)[0]}
                <strong className="font-semibold text-[var(--sl-text)]">{tenantName}</strong>
                {welcomeLead.split(tenantName)[1]}
              </>
            ) : (
              welcomeLead
            )}
          </p>
          <div className="mt-6">
            <span
              className="inline-flex items-center gap-2 rounded-[var(--sl-r-sm)] border px-4 py-2.5 text-sm font-medium text-[var(--sl-text)]"
              style={{
                background: "oklch(0.62 0.135 252 / 0.2)",
                borderColor: "oklch(0.62 0.135 252 / 0.45)",
              }}
            >
              <Calendar className="h-4 w-4 text-[var(--sl-primary-hi)]" />
              Próxima sessão · hoje às 19:00
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {stats.map((item) => (
          <StatCard
            key={item.name}
            icon={item.icon}
            tint={item.tint}
            label={item.name}
            value={item.value}
          />
        ))}
      </div>

      {/* Painéis inferiores */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="sl-card flex min-h-[280px] flex-col p-5 sm:p-6 md:min-h-[360px]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-[1.05rem] font-bold text-[var(--sl-text)]">
              <Calendar className="h-5 w-5 text-[var(--sl-primary-hi)]" />
              {dbStatsType === "VEREADOR" ? "Minha agenda" : "Cronograma legislativo"}
            </h2>
            <Link href="/sessoes" className="sl-badge plain w-fit cursor-pointer hover:text-[var(--sl-text)]">
              Ver calendário
            </Link>
          </div>
          <div className="sl-empty min-h-[200px] flex-1">
            <Clock className="h-10 w-10 text-[var(--sl-border)] opacity-80" />
            <p className="max-w-xs text-[0.85rem] text-[var(--sl-faint)]">
              Agenda de sessões e comissões em processamento…
            </p>
          </div>
        </div>

        <div className="sl-card flex min-h-[280px] flex-col p-5 sm:p-6 md:min-h-[360px]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex flex-wrap items-center gap-2 text-[1.05rem] font-bold text-[var(--sl-text)]">
              {dbStatsType === "VEREADOR" ? (
                <>
                  <Users className="h-5 w-5 text-[var(--sl-success)]" />
                  Convites de coautoria
                </>
              ) : (
                <>
                  <DoorOpen className="h-5 w-5 text-[var(--sl-gold)]" />
                  Monitor de visitantes
                </>
              )}
            </h2>
            {dbStatsType === "VEREADOR" && (adminData.convites?.length ?? 0) > 0 && (
              <span className="sl-badge success w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {(adminData.convites?.length ?? 0)} novo(s)
              </span>
            )}
          </div>

          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
            {dbStatsType === "VEREADOR" ? (
              (adminData.convites?.length ?? 0) === 0 ? (
                <div className="sl-empty min-h-[200px] border-none bg-transparent">
                  <FileText className="h-10 w-10 text-[var(--sl-border)]" />
                  <p className="sl-kicker">Nenhum convite pendente</p>
                </div>
              ) : (
                (adminData.convites ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className="rounded-[var(--sl-r)] border p-4 transition-colors hover:border-[oklch(0.62_0.135_252_/_0.35)]"
                    style={{
                      background: "var(--sl-inset)",
                      borderColor: "var(--sl-border-faint)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="sl-kicker flex items-center gap-2 text-[var(--sl-primary-hi)]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--sl-primary)]" />
                        Coautoria
                      </span>
                      <span className="sl-kicker text-[var(--sl-faint)]">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[var(--sl-text)]">
                      {c.proposicao?.ementa}
                    </p>
                    <div
                      className="mt-3 flex items-center justify-between gap-2 border-t pt-3"
                      style={{ borderColor: "var(--sl-border-faint)" }}
                    >
                      <p className="sl-kicker text-[var(--sl-muted)]">
                        Autor: {c.proposicao?.autor?.nome_parlamentar}
                      </p>
                      <button
                        type="button"
                        className="sl-kicker text-[var(--sl-primary-hi)] hover:underline"
                      >
                        Analisar
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : adminData.visitantes?.filter((v: any) => !v.data_saida).length === 0 ? (
              <div className="sl-empty min-h-[200px] border-none bg-transparent">
                <Users className="h-10 w-10 text-[var(--sl-border)]" />
                <p className="sl-kicker">Prédio sem visitantes no momento</p>
              </div>
            ) : (
              adminData.visitantes
                ?.filter((v: any) => !v.data_saida)
                .map((v: any) => (
                  <div
                    key={v.id}
                    className="flex flex-col gap-3 rounded-[var(--sl-r)] border p-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      background: "var(--sl-inset)",
                      borderColor: "var(--sl-border-faint)",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <InstitutionalAvatar nome={v.nome_completo} size={42} />
                      <div>
                        <p className="text-sm font-bold text-[var(--sl-text)]">{v.nome_completo}</p>
                        <p className="sl-kicker mt-0.5">
                          Destino: {v.vereador?.nome_parlamentar || "Secretaria Geral"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                      <span className="sl-badge success">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        Presente
                      </span>
                      <span
                        className="font-mono text-[0.7rem] text-[var(--sl-faint)]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {v.data_entrada
                          ? new Date(v.data_entrada).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
