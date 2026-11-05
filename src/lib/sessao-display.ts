/** Rótulos curtos para tipo enum `SessaoTipo` (exibição). */
const TIPO_SESSAO_LABEL: Record<string, string> = {
  ORDINARIA: "Sessão ordinária",
  EXTRAORDINARIA: "Sessão extraordinária",
  SOLENE: "Sessão solene",
  AUDIENCIA_PUBLICA: "Audiência pública",
};

export type SessaoLegendaInput = {
  numero_sessao?: number | null;
  data_sessao?: Date | string | null;
  tipo?: string | null;
  secao_legislativa?: string | null;
};

/** Lista, selects e OBS: sessão + data. */
export function formatSessaoLegenda(s: SessaoLegendaInput): string {
  const n = s.numero_sessao != null ? String(s.numero_sessao) : "?";
  const sec = String(s.secao_legislativa ?? "").trim();
  const d = s.data_sessao ? new Date(s.data_sessao as string) : null;
  const ds = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : "—";
  if (sec) {
    return `Sessão ${n} · ${sec} · ${ds}`;
  }
  const tipoKey = String(s.tipo ?? "").toUpperCase();
  const tipo =
    TIPO_SESSAO_LABEL[tipoKey] || (s.tipo ? String(s.tipo).replaceAll("_", " ") : "Sessão");
  return `Sessão ${n} (${tipo}) · ${ds}`;
}

/** Barra do painel: número + seção ou tipo. */
export function rotuloPainelSessao(
  sessao: SessaoLegendaInput | null | undefined,
): string {
  if (!sessao) return "Aguardando Sessão Legislativa";
  const n = sessao.numero_sessao != null ? String(sessao.numero_sessao) : "?";
  const sec = String(sessao.secao_legislativa ?? "").trim();
  if (sec) {
    return `Sessão nº ${n} — ${sec}`;
  }
  const tipoKey = String(sessao.tipo ?? "").toUpperCase();
  const tipo =
    TIPO_SESSAO_LABEL[tipoKey] ||
    (sessao.tipo ? String(sessao.tipo).replaceAll("_", " ") : "Sessão legislativa");
  return `Sessão nº ${n} — ${tipo}`;
}
