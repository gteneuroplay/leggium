/** Campos mínimos para rótulo de autoria em listagens e painel. */
export type AutoriaProposicaoInput = {
  autoria_mesa?: boolean | null;
  autoria_poder_executivo?: boolean | null;
  autor?: { nome_parlamentar?: string | null } | null;
};

export function rotuloAutoriaProposicao(p: AutoriaProposicaoInput | null | undefined): string {
  if (!p) return "Não identificado";
  if (p.autoria_poder_executivo) return "Poder Executivo";
  if (p.autoria_mesa) return "Mesa Diretora";
  return p.autor?.nome_parlamentar?.trim() || "Não identificado";
}

export function iniciaisAutoriaProposicao(p: AutoriaProposicaoInput | null | undefined): string {
  if (!p) return "—";
  if (p.autoria_poder_executivo) return "PE";
  if (p.autoria_mesa) return "MD";
  const n = p.autor?.nome_parlamentar?.trim();
  if (!n) return "—";
  return n.substring(0, 2).toUpperCase();
}
