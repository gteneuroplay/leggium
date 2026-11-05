import { formatSessaoLegenda } from "@/lib/sessao-display";
import type { SessaoOption } from "@/components/dashboard/DashboardObsPanel";

export function pickDefaultSessaoId(sessoes: Array<{ id: string; status: string }>) {
  const ativa = sessoes.find((x) => x.status === "ABERTA" || x.status === "EM_VOTACAO");
  return ativa?.id ?? sessoes[0]?.id ?? null;
}

export function mapSessoesForObs(
  sessoes: Array<{
    id: string;
    status: string;
    numero_sessao?: number | null;
    data_sessao?: Date | null;
    tipo?: string | null;
    secao_legislativa?: string | null;
  }>,
): SessaoOption[] {
  return sessoes.map((s) => ({
    id: s.id,
    status: s.status,
    label: formatSessaoLegenda(s),
  }));
}
