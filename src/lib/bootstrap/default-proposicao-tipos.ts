import { prisma } from "@/lib/prisma";

type DefaultTipo = {
  sigla: string;
  nome: string;
  descricao?: string;
};

const DEFAULT_TIPOS: DefaultTipo[] = [
  { sigla: "PL", nome: "Projeto de Lei", descricao: "Proposição legislativa para criação, alteração ou revogação de leis." },
  { sigla: "PR", nome: "Projeto de Resolução", descricao: "Norma interna da Câmara Municipal." },
  { sigla: "PDL", nome: "Decreto Legislativo", descricao: "Ato legislativo de competência exclusiva da Câmara." },
  { sigla: "MOC", nome: "Moção", descricao: "Manifestação política de aplauso, repúdio ou apoio." },
  { sigla: "REQ", nome: "Requerimento", descricao: "Solicitação formal de providências, informações ou medidas." },
  { sigla: "IND", nome: "Indicação", descricao: "Sugestão ao Poder Executivo para adoção de providências." },
  { sigla: "ATA", nome: "Ata", descricao: "Registro formal das deliberações e ocorrências de sessão ou reunião." },
  {
    sigla: "PAREC",
    nome: "Parecer de Comissão",
    descricao: "Manifestação técnica ou jurídica de comissão permanente ou especial sobre matéria em tramitação.",
  },
  { sigla: "EMD", nome: "Emenda", descricao: "Alteração proposta em texto de proposição em tramitação." },
  { sigla: "PORT", nome: "Portaria", descricao: "Ato administrativo da estrutura da Câmara." },
];

export async function ensureDefaultProposicaoTiposForTenant(tenantId: string) {
  for (const tipo of DEFAULT_TIPOS) {
    const existing = await prisma.proposicaoTipo.findFirst({
      where: {
        tenant_id: tenantId,
        sigla: tipo.sigla,
      },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.proposicaoTipo.update({
        where: { id: existing.id },
        data: {
          nome: tipo.nome,
          descricao: tipo.descricao || null,
        },
      });
      continue;
    }

    await prisma.proposicaoTipo.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        sigla: tipo.sigla,
        nome: tipo.nome,
        descricao: tipo.descricao || null,
      },
    });
  }
}
