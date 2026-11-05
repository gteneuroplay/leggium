/** Mapeia o nome do tipo (tabela proposicao_tipos) para o enum gravado em proposicoes.tipo. */
export function proposicaoTipoEnumFromNome(nome: string): string {
  const mapTipoToEnum: Record<string, string> = {
    "Projeto de Lei": "PROJETO_DE_LEI",
    "Indicação": "INDICACAO",
    "Moção": "MOCAO",
    "Requerimento": "REQUERIMENTO",
    "Emendas": "EMENDA",
    "Emenda": "EMENDA",
    "Ata": "ATA",
    "Parecer de Comissão": "PARECER_DE_COMISSAO",
    "Decreto": "DECRETO",
    "Decreto Legislativo": "DECRETO_LEGISLATIVO",
    "Mesa Diretora": "MESA_DIRETORA",
    "Resolução": "PROJETO_DE_RESOLUCAO",
    "Projeto de Resolução": "PROJETO_DE_RESOLUCAO",
    "Proposição": "PROPOSICAO",
    "Portaria": "PORTARIA",
    "Outros": "OUTROS",
  };
  return mapTipoToEnum[nome] || "INDICACAO";
}

const TIPO_ENUM_LABELS: Record<string, string> = {
  PARECER_DE_COMISSAO: "Parecer de Comissão",
  PROJETO_DE_LEI: "Projeto de Lei",
  PROJETO_DE_RESOLUCAO: "Projeto de Resolução",
  DECRETO_LEGISLATIVO: "Decreto Legislativo",
};

export function formatProposicaoTipoLabel(tipoEnum?: string | null): string {
  if (!tipoEnum) return "Proposição";
  const key = String(tipoEnum);
  if (TIPO_ENUM_LABELS[key]) return TIPO_ENUM_LABELS[key];
  return key.replace(/_/g, " ");
}
