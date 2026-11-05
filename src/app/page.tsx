import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppLayout } from "@/components/layout/AppLayout";
import { getCurrentUser } from "@/lib/dal";
import { parseTenantSlugFromHost } from "@/lib/tenant-from-host";
import ProductLanding from "@/components/marketing/ProductLanding";
import { getVereadores } from "./vereadores/actions";
import { getSetores } from "./setores/actions";
import { getVisitantes } from "./visitantes/actions";
import { getUsuarios } from "./usuarios/actions";
import { getDashboardStats } from "./proposicoes/actions";
import { getSessoes } from "./sessoes/actions";
import {
  Users,
  Gavel,
  Building2,
  DoorOpen,
  Calendar,
  FileText,
} from "lucide-react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { DashboardObsPanel, type SessaoOption } from "@/components/dashboard/DashboardObsPanel";
import { canAccessObsTab, prefersObsHubAsHome } from "@/lib/permissions/obs";
import { mapSessoesForObs, pickDefaultSessaoId } from "@/lib/obs/hub-data";

const APP_BASE_DOMAIN = process.env.APP_BASE_DOMAIN || "syslegis.com";

function hostFromHeaders(h: Headers) {
  return (h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "")
    .split(":")[0]
    .toLowerCase();
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const tenantSlug = parseTenantSlugFromHost(hostFromHeaders(h), APP_BASE_DOMAIN);
  const user = await getCurrentUser();
  if (tenantSlug === null && !user) {
    return {
      title: "SysLegis — Gestão legislativa para Câmaras Municipais",
      description:
        "Painel plenário, votações, proposições, tramitação e multi-câmara. SaaS moderno para o legislativo municipal.",
    };
  }
  return {
    title: "SysLegis - Sistema de Gestão Legislativa",
    description: "Plataforma SaaS para Câmaras Municipais",
  };
}

const ICON_MAP: Record<
  string,
  {
    icon: typeof FileText;
    tint: "primary" | "gold" | "success" | "info";
  }
> = {
  proposicoes: { icon: FileText, tint: "primary" },
  comissoes: { icon: Building2, tint: "gold" },
  pauta: { icon: Calendar, tint: "info" },
  convites: { icon: Users, tint: "success" },
};

function DashboardTabsFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div
        className="h-11 w-full max-w-xs animate-pulse rounded-[var(--sl-r)]"
        style={{ background: "var(--sl-surface)" }}
      />
      <div
        className="h-44 w-full animate-pulse rounded-[var(--sl-r-lg)]"
        style={{ background: "var(--sl-surface)" }}
      />
    </div>
  );
}

export default async function Dashboard() {
  const h = await headers();
  const tenantSlug = parseTenantSlugFromHost(hostFromHeaders(h), APP_BASE_DOMAIN);
  const user = await getCurrentUser();

  /** syslegis.com, www ou host sem subdomínio de câmara: landing de produto para visitantes. */
  if (tenantSlug === null && !user) {
    return <ProductLanding />;
  }

  const permissoes = user?.profile?.setor?.permissoes as Record<string, unknown> | undefined;
  if (user && prefersObsHubAsHome(user.profile.role, permissoes)) {
    redirect("/obs");
  }

  const dbStats = await getDashboardStats();

  let adminData: any = {};
  if (dbStats?.type === "ADMIN") {
    const [vData, setores, visitantes, usuarios] = await Promise.all([
      getVereadores(),
      getSetores(),
      getVisitantes(),
      getUsuarios(),
    ]);
    adminData = {
      vereadores: (vData as any).vereadores || [],
      setores,
      visitantes,
      usuarios,
    };
  }

  const sessoesRaw = await getSessoes();
  const sessoesObs = mapSessoesForObs(sessoesRaw);
  const defaultSessaoId = pickDefaultSessaoId(sessoesRaw);

  const stats =
    dbStats?.type === "VEREADOR" && dbStats.stats
      ? dbStats.stats.map((s: any) => ({ ...s, ...ICON_MAP[s.key] }))
      : [
          {
            name: "Vereadores",
            value: adminData.vereadores?.length || 0,
            icon: Gavel,
            tint: "primary" as const,
          },
          {
            name: "Setores",
            value: adminData.setores?.length || 0,
            icon: Building2,
            tint: "gold" as const,
          },
          {
            name: "Visitantes ativos",
            value: adminData.visitantes?.filter((v: any) => !v.data_saida).length || 0,
            icon: DoorOpen,
            tint: "success" as const,
          },
          {
            name: "Usuários ativos",
            value: adminData.usuarios?.length || 0,
            icon: Users,
            tint: "info" as const,
          },
        ];

  const tenantName = user?.profile?.tenant?.nome_camara || "Câmara";

  const welcomeLead =
    dbStats?.type === "VEREADOR"
      ? "Acompanhe o andamento das suas matérias legislativas e interações com outros parlamentares em tempo real."
      : user?.profile?.role === "ADMIN_MASTER"
        ? `Você está no painel da instalação ${tenantName}. A visão geral da plataforma (câmaras, domínios e estatísticas) fica disponível pelo botão Ir à plataforma no topo.`
        : `Bem-vindo ao centro de operações da ${tenantName}. Tudo pronto para a gestão legislativa de hoje.`;

  const role = user?.profile?.role;
  const showObsTab =
    role === "ADMIN_MASTER" ||
    role === "DEV" ||
    canAccessObsTab(user?.profile?.setor?.permissoes as Record<string, unknown> | undefined);

  const overview = (
    <DashboardOverview
      userFirstName={user?.profile?.nome?.split(" ")[0] || "Administrador"}
      welcomeLead={welcomeLead}
      tenantName={tenantName}
      stats={stats}
      dbStatsType={dbStats?.type}
      adminData={{
        visitantes: adminData.visitantes,
        convites: dbStats?.type === "VEREADOR" ? dbStats.convites : undefined,
      }}
    />
  );

  const obsPanel = (
    <DashboardObsPanel sessoes={sessoesObs} defaultSessaoId={defaultSessaoId} />
  );

  return (
    <AppLayout>
      <Suspense fallback={<DashboardTabsFallback />}>
        <DashboardClient overview={overview} obsPanel={obsPanel} showObsTab={showObsTab} />
      </Suspense>
    </AppLayout>
  );
}
