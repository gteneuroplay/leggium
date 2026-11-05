"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logout } from "../auth/actions";
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  Tv,
  ClipboardList,
  Scale,
  CalendarDays,
  ShieldCheck,
  Vote,
  Building2,
  Gavel,
  Mic2,
  LogOut,
  Landmark,
  GitBranch,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessObsTab, hasDashboardTabAccess } from "@/lib/permissions/obs";

type SidebarNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  dashboardTab?: "inicio" | "obs";
  roles?: string[];
  role?: string;
  sector?: string;
};

type SidebarNavGroup = { category: string; items: SidebarNavItem[] };

const navigation: SidebarNavGroup[] = [
  {
    category: "Início",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, dashboardTab: "inicio" as const },
      { name: "OBS", href: "/obs", icon: Video },
    ],
  },
  {
    category: "Processo Legislativo",
    items: [
      { name: "Sessões", href: "/sessoes", icon: CalendarDays },
      { name: "Tramitação", href: "/tramitacao", icon: Scale, roles: ["JURIDICO", "COMISSAO", "ADMIN_CAMARA"] },
      { name: "Pautas da Sessão", href: "/pautas", icon: ClipboardList, roles: ["SECRETaria", "OPERADOR", "ADMIN_CAMARA"] },
      { name: "Proposições", href: "/proposicoes", icon: FileText },
      { name: "Painel TV", href: "/painel/tv", icon: Tv },
      { name: "Painel do Operador", href: "/painel/operador", icon: ShieldCheck, sector: "OPERADOR" },
      { name: "Painel do Presidente", href: "/painel/presidente", icon: Landmark, roles: ["PRESIDENTE", "ADMIN_MASTER", "DEV"] },
      { name: "Painel do Vereador", href: "/painel/vereador", icon: Vote, role: "VEREADOR" },
    ],
  },
  {
    category: "Institucional",
    items: [
      { name: "Bancadas", href: "/bancadas", icon: Building2 },
      { name: "Vereadores", href: "/vereadores", icon: Gavel },
      { name: "Comissões", href: "/comissoes", icon: GitBranch },
      { name: "Oradores", href: "/visitantes", icon: Mic2 },
    ],
  },
  {
    category: "Administração",
    items: [
      { name: "Setores", href: "/setores", icon: Building2 },
      { name: "Usuários", href: "/usuarios", icon: Users },
      { name: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

interface SidebarProps {
  user: any;
  onNavigate?: () => void;
}

export function Sidebar({ user, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizeSetor = (value?: string) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

  const userRole = user?.profile?.role;
  const userEmail = user?.email;
  const userSector = normalizeSetor(user?.profile?.setor?.nome);
  const isVereador = userRole === "VEREADOR";
  const isPresidenteMesa = String(user?.profile?.vereador?.cargo_mesa || "").toUpperCase() === "PRESIDENTE";
  const isDev = userEmail === "bergzxgs@gmail.com" || userRole === "ADMIN_MASTER" || userRole === "DEV";
  const setorPermissoes = (user?.profile?.setor?.permissoes || {}) as Record<string, boolean>;
  const vereadorComissaoAccess =
    (user?.profile?.vereador?.comissoes_membro?.length || 0) > 0 ||
    (user?.profile?.vereador?.comissoes_presididas?.length || 0) > 0 ||
    (user?.profile?.vereador?.comissoes_relatadas?.length || 0) > 0;
  const isAdministradorFluxo =
    userRole === "ADMIN_MASTER" || userRole === "DEV" || userSector === "ADMINISTRADOR";
  const isJuridicoFluxo = userRole === "JURIDICO" || userSector === "JURIDICO";
  const isComissaoFluxo = userSector === "COMISSAO";
  const canSeeTramitacao = isAdministradorFluxo || isJuridicoFluxo || isComissaoFluxo || (isVereador && vereadorComissaoAccess);
  const vereadorAllowedHrefs = new Set([
    "/",
    "/proposicoes",
    "/painel/vereador",
    "/tramitacao",
    ...(isPresidenteMesa ? ["/painel/presidente"] : []),
  ]);

  const permissionByHref: Record<string, string> = {
    "/": "dashboard",
    "/sessoes": "sessoes",
    "/tramitacao": "tramitacao",
    "/pautas": "pautas",
    "/proposicoes": "proposicoes",
    "/painel/tv": "painel_tv",
    "/painel/operador": "painel_operador",
    "/painel/presidente": "painel_presidente",
    "/painel/vereador": "painel_vereador",
    "/bancadas": "bancadas",
    "/vereadores": "vereadores",
    "/comissoes": "comissoes",
    "/visitantes": "visitantes",
    "/setores": "setores",
    "/cargos": "cargos",
    "/usuarios": "usuarios",
    "/configuracoes": "configuracoes",
  };

  const filteredNavigation = navigation
    .map((group) => {
      const items = group.items.filter((item) => {
        if (isDev) return true;
        if (isVereador) return vereadorAllowedHrefs.has(item.href);
        if (item.href === "/tramitacao") return canSeeTramitacao;
        if ((item as any).roles && !(item as any).roles.includes(userRole)) return false;
        if (item.role && userRole !== item.role) return false;
        if (item.href === "/painel/operador" && userRole === "ADMIN_CAMARA") return true;
        if (item.sector && userSector !== item.sector) return false;
        if (item.href === "/obs") return canAccessObsTab(setorPermissoes);
        if (item.href === "/" && item.dashboardTab === "inicio") return hasDashboardTabAccess(setorPermissoes);
        const permissionKey = permissionByHref[item.href];
        if (permissionKey && setorPermissoes[permissionKey] !== true) return false;
        return true;
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  return (
    <div
      className="relative z-20 flex h-full w-full flex-col"
      style={{ background: "var(--sl-bg-rail)", borderColor: "var(--sl-border-faint)" }}
    >
      <div
        className="flex shrink-0 items-center gap-3 border-b px-5"
        style={{
          height: "calc(var(--sl-topbar-h) + var(--sl-platform-h))",
          borderColor: "var(--sl-border-faint)",
        }}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-[var(--sl-on-primary)] shadow-sm"
          style={{
            background: "linear-gradient(160deg, var(--sl-primary-hi), var(--sl-primary-lo))",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.25), 0 1px 2px oklch(0 0 0 / 0.3)",
          }}
        >
          <Gavel className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <div className="text-[1.22rem] font-extrabold tracking-tight text-[var(--sl-text)]">
            Sys<span className="text-[var(--sl-primary-hi)]">Legis</span>
          </div>
          <div className="sl-kicker mt-px text-[0.58rem] tracking-[0.22em] text-[var(--sl-faint)]">
            Gestão Legislativa
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-4">
          {filteredNavigation.map((group) => (
            <div key={group.category}>
              <span className="sl-kicker mb-2 block px-2">{group.category}</span>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const dashTab = item.dashboardTab;
                  const tab = searchParams.get("tab");
                  let isActive =
                    pathname === item.href ||
                    (item.href !== "/" && !String(item.href).includes("?") && pathname.startsWith(item.href));
                  if (dashTab === "inicio") isActive = pathname === "/" && tab !== "obs";
                  if (item.href === "/obs") isActive = pathname === "/obs" || pathname.startsWith("/obs/");

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => onNavigate?.()}
                      className={cn("sl-nav-item", isActive && "active")}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--sl-border-faint)" }}>
        <form action={logout}>
          <button
            type="submit"
            className="sl-nav-item w-full text-[var(--sl-danger)] hover:bg-[var(--sl-danger-bg)]"
            title="Sair"
          >
            <LogOut aria-hidden="true" />
            <span>Sair</span>
          </button>
        </form>
      </div>
    </div>
  );
}
