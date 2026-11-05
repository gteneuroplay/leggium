import { Bell, Columns3, Menu } from "lucide-react";
import { voltarSomentePlataforma } from "@/app/plataforma/actions";
import { InstitutionalAvatar } from "@/components/ui/InstitutionalAvatar";

export function Header({
  user,
  onOpenNav,
  masterPlataformaHref = "/plataforma",
}: {
  user: any;
  onOpenNav?: () => void;
  masterPlataformaHref?: string;
}) {
  const tenantName = user?.profile?.tenant?.nome_camara || "SysLegis";
  const userName = user?.profile?.nome || "Usuário";
  const isMasterEmInstalacao =
    user?.profile?.role === "ADMIN_MASTER" && Boolean(user?.masterActingTenantId);

  const ROLE_LABELS: Record<string, string> = {
    ADMIN_MASTER: "Administrador Master",
    ADMIN_CAMARA: "Administrador da Câmara",
    SECRETARIA: "Secretaria",
    JURIDICO: "Jurídico",
    COMISSAO: "Comissão",
    VEREADOR: "Vereador",
    EXECUTIVO: "Executivo",
    OPERADOR: "Operador",
  };

  const setorLabel = user?.profile?.setor?.nome;
  const userRole =
    setorLabel || ROLE_LABELS[user?.profile?.role || ""] || user?.profile?.role || "Usuário";

  return (
    <header className="relative z-10 flex shrink-0 flex-col">
      {isMasterEmInstalacao ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-2 sm:px-7"
          style={{
            height: "var(--sl-platform-h)",
            background: "var(--sl-bg-topbar)",
            borderBottom: "1px solid var(--sl-border-faint)",
          }}
        >
          <p className="flex flex-wrap items-center gap-2 text-[0.8rem] text-[var(--sl-text-2)]">
            <span className="sl-kicker text-[0.62rem] tracking-[0.18em] text-[var(--sl-gold)]">Plataforma</span>
            <span>· Operando a instalação:</span>
            <strong className="font-semibold text-[var(--sl-text)]">{tenantName}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={masterPlataformaHref} className="sl-pbtn">
              Ir à plataforma
            </a>
            <form action={voltarSomentePlataforma}>
              <button type="submit" className="sl-pbtn sl-pbtn-gold">
                Sair desta instalação
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div
        className="flex items-center justify-between gap-2 px-5 sm:px-7"
        style={{
          height: "var(--sl-topbar-h)",
          borderBottom: "1px solid var(--sl-border-faint)",
          background: "linear-gradient(180deg, var(--sl-bg-topbar), var(--sl-bg))",
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {onOpenNav ? (
            <button
              type="button"
              onClick={onOpenNav}
              className="sl-icon-btn md:hidden"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <div
            className="hidden h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border md:grid"
            style={{
              background: "var(--sl-surface-2)",
              borderColor: "var(--sl-border)",
              color: "var(--sl-gold)",
            }}
          >
            <Columns3 className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="min-w-0 truncate text-[1.06rem] font-bold tracking-tight text-[var(--sl-text)]">
            {tenantName}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <button type="button" className="sl-icon-btn">
            <span className="sr-only">Ver notificações</span>
            <Bell className="h-[18px] w-[18px]" aria-hidden />
            <span
              className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full border-2"
              style={{ background: "var(--sl-gold)", borderColor: "var(--sl-bg-topbar)" }}
            />
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight md:block">
              <div className="text-[0.86rem] font-bold text-[var(--sl-text)]">{userName}</div>
              <div className="sl-kicker mt-0.5 text-[0.58rem] tracking-[0.14em]">{userRole}</div>
            </div>
            <InstitutionalAvatar nome={userName} size={40} />
          </div>
        </div>
      </div>
    </header>
  );
}
