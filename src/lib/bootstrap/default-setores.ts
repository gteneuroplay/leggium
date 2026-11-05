import { prisma } from "@/lib/prisma";

type Permissoes = Record<string, boolean>;

type DefaultSetor = {
  nome: string;
  sigla: string;
  permissoes: Permissoes;
};

const ALL_ABAS: Permissoes = {
  dashboard: true,
  obs: true,
  sessoes: true,
  tramitacao: true,
  pautas: true,
  proposicoes: true,
  painel: true,
  painel_tv: true,
  painel_operador: true,
  painel_vereador: true,
  bancadas: true,
  vereadores: true,
  comissoes: true,
  visitantes: true,
  setores: true,
  cargos: true,
  usuarios: true,
  configuracoes: true,
};

const DEFAULT_SETORES: DefaultSetor[] = [
  {
    nome: "Administrador",
    sigla: "ADM",
    permissoes: ALL_ABAS,
  },
  {
    nome: "Jurídico",
    sigla: "JUR",
    permissoes: {
      dashboard: false,
      obs: false,
      sessoes: false,
      tramitacao: true,
      pautas: false,
      proposicoes: false,
      painel: false,
      painel_tv: false,
      painel_operador: false,
      painel_vereador: false,
      bancadas: false,
      vereadores: false,
      comissoes: false,
      visitantes: false,
      setores: false,
      cargos: false,
      usuarios: false,
      configuracoes: false,
    },
  },
  {
    nome: "Operador",
    sigla: "OPE",
    permissoes: {
      dashboard: false,
      obs: true,
      sessoes: false,
      tramitacao: false,
      pautas: false,
      proposicoes: true,
      painel: false,
      painel_tv: false,
      painel_operador: true,
      painel_vereador: false,
      bancadas: false,
      vereadores: true,
      comissoes: false,
      visitantes: false,
      setores: false,
      cargos: false,
      usuarios: false,
      configuracoes: false,
    },
  },
];

export const SYSTEM_SETORES = ["ADMINISTRADOR", "JURIDICO", "OPERADOR"] as const;

export function normalizeSetorNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function isSystemSetorNome(nome: string) {
  return SYSTEM_SETORES.includes(normalizeSetorNome(nome) as (typeof SYSTEM_SETORES)[number]);
}

export async function ensureDefaultSetoresForTenant(tenantId: string) {
  for (const setor of DEFAULT_SETORES) {
    const existing = await prisma.setor.findFirst({
      where: {
        tenant_id: tenantId,
        nome: setor.nome,
      },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.setor.update({
        where: { id: existing.id },
        data: {
          sigla: setor.sigla,
          permissoes: setor.permissoes,
          deleted_at: null,
          updated_at: new Date(),
        },
      });
      continue;
    }

    await prisma.setor.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        nome: setor.nome,
        sigla: setor.sigla,
        permissoes: setor.permissoes,
      },
    });
  }
}
