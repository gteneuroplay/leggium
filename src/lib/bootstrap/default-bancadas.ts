import { prisma } from "@/lib/prisma";

type DefaultBancada = {
  sigla: string;
  nome: string;
  logo_url: string;
};

const DEFAULT_BANCADAS: DefaultBancada[] = [
  { sigla: "MDB", nome: "Movimento Democrático Brasileiro", logo_url: "https://placehold.co/256x256/15803d/ffffff.svg?text=MDB" },
  { sigla: "PL", nome: "Partido Liberal", logo_url: "https://placehold.co/256x256/1d4ed8/ffffff.png?text=PL" },
  { sigla: "PP", nome: "Progressistas", logo_url: "https://placehold.co/256x256/b45309/ffffff.jpg?text=PP" },
  { sigla: "PSD", nome: "Partido Social Democrático", logo_url: "https://placehold.co/256x256/7c3aed/ffffff.webp?text=PSD" },
  { sigla: "UNIÃO", nome: "União Brasil", logo_url: "https://placehold.co/256x256/0f172a/ffffff.svg?text=UNIAO" },
  { sigla: "PT", nome: "Partido dos Trabalhadores", logo_url: "https://placehold.co/256x256/b91c1c/ffffff.png?text=PT" },
  { sigla: "PSB", nome: "Partido Socialista Brasileiro", logo_url: "https://placehold.co/256x256/1e40af/ffffff.jpg?text=PSB" },
  { sigla: "PSDB", nome: "Partido da Social Democracia Brasileira", logo_url: "https://placehold.co/256x256/f97316/ffffff.webp?text=PSDB" },
  { sigla: "PDT", nome: "Partido Democrático Trabalhista", logo_url: "https://placehold.co/256x256/2563eb/ffffff.svg?text=PDT" },
  { sigla: "REPUBLICANOS", nome: "Republicanos", logo_url: "https://placehold.co/256x256/1d4ed8/ffffff.png?text=REP" },
  { sigla: "PODE", nome: "Podemos", logo_url: "https://placehold.co/256x256/0ea5e9/ffffff.jpg?text=PODE" },
  { sigla: "AVANTE", nome: "Avante", logo_url: "https://placehold.co/256x256/0891b2/ffffff.webp?text=AVANTE" },
  { sigla: "CIDADANIA", nome: "Cidadania", logo_url: "https://placehold.co/256x256/a855f7/ffffff.svg?text=CIDAD" },
  { sigla: "PV", nome: "Partido Verde", logo_url: "https://placehold.co/256x256/16a34a/ffffff.png?text=PV" },
  { sigla: "PCdoB", nome: "Partido Comunista do Brasil", logo_url: "https://placehold.co/256x256/dc2626/ffffff.jpg?text=PCdoB" },
  { sigla: "PSOL", nome: "Partido Socialismo e Liberdade", logo_url: "https://placehold.co/256x256/f97316/ffffff.webp?text=PSOL" },
  { sigla: "REDE", nome: "Rede Sustentabilidade", logo_url: "https://placehold.co/256x256/16a34a/ffffff.svg?text=REDE" },
  { sigla: "SOLIDARIEDADE", nome: "Solidariedade", logo_url: "https://placehold.co/256x256/06b6d4/ffffff.png?text=SOLID" },
  { sigla: "NOVO", nome: "Partido Novo", logo_url: "https://placehold.co/256x256/f97316/ffffff.jpg?text=NOVO" },
  { sigla: "PRD", nome: "Partido Renovação Democrática", logo_url: "https://placehold.co/256x256/9333ea/ffffff.webp?text=PRD" },
  { sigla: "AGIR", nome: "Agir", logo_url: "https://placehold.co/256x256/0d9488/ffffff.svg?text=AGIR" },
  { sigla: "DC", nome: "Democracia Cristã", logo_url: "https://placehold.co/256x256/2563eb/ffffff.png?text=DC" },
  { sigla: "PMB", nome: "Partido da Mulher Brasileira", logo_url: "https://placehold.co/256x256/ec4899/ffffff.jpg?text=PMB" },
  { sigla: "PRTB", nome: "Partido Renovador Trabalhista Brasileiro", logo_url: "https://placehold.co/256x256/1d4ed8/ffffff.webp?text=PRTB" },
  { sigla: "UP", nome: "Unidade Popular", logo_url: "https://placehold.co/256x256/dc2626/ffffff.svg?text=UP" },
  { sigla: "PSTU", nome: "Partido Socialista dos Trabalhadores Unificado", logo_url: "https://placehold.co/256x256/b91c1c/ffffff.png?text=PSTU" },
  { sigla: "PCB", nome: "Partido Comunista Brasileiro", logo_url: "https://placehold.co/256x256/991b1b/ffffff.jpg?text=PCB" },
  { sigla: "PCO", nome: "Partido da Causa Operária", logo_url: "https://placehold.co/256x256/7f1d1d/ffffff.webp?text=PCO" },
  { sigla: "MOBILIZA", nome: "Mobiliza", logo_url: "https://placehold.co/256x256/4f46e5/ffffff.svg?text=MOB" },
  { sigla: "PMN", nome: "Partido da Mobilização Nacional", logo_url: "https://placehold.co/256x256/2563eb/ffffff.png?text=PMN" },
];

export async function ensureDefaultBancadasForTenant(tenantId: string) {
  for (const bancada of DEFAULT_BANCADAS) {
    const existing = await prisma.bancada.findFirst({
      where: {
        tenant_id: tenantId,
        sigla: bancada.sigla,
      },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.bancada.update({
        where: { id: existing.id },
        data: {
          nome: bancada.nome,
          logo_url: bancada.logo_url,
          updated_at: new Date(),
        },
      });
      continue;
    }

    await prisma.bancada.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        sigla: bancada.sigla,
        nome: bancada.nome,
        logo_url: bancada.logo_url,
      },
    });
  }
}
