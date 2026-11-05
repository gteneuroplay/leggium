import { AppLayout } from "@/components/layout/AppLayout";
import { getComissoes } from "../proposicoes/actions";
import { TramitacaoClient } from "./TramitacaoClient";
import { Metadata } from "next";
import { getCurrentUser } from "@/lib/dal";
import { getUsuarios } from "../usuarios/actions";
import { prisma } from "@/lib/prisma";
import { normalizeSetorNome } from "@/lib/bootstrap/default-setores";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { mergeProposicoesComPoderExecutivo } from "@/lib/proposicao-poder-executivo";

export const metadata: Metadata = {
  title: "Tramitação e Pareceres | SysLegis",
};

export default async function TramitacaoPage() {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) redirect("/login");

  const setorNome = normalizeSetorNome(user.profile?.setor?.nome || "");
  const isAdmin =
    user.profile.role === "ADMIN_MASTER" ||
    user.profile.role === "DEV" ||
    setorNome === "ADMINISTRADOR";
  const isVereador = user.profile.role === "VEREADOR";
  const vereadorComissaoAccess =
    (user.profile?.vereador?.comissoes_membro?.length || 0) > 0 ||
    (user.profile?.vereador?.comissoes_presididas?.length || 0) > 0 ||
    (user.profile?.vereador?.comissoes_relatadas?.length || 0) > 0;

  const canAccessTramitacao =
    isAdmin ||
    setorNome === "JURIDICO" ||
    setorNome === "COMISSAO" ||
    isVereador;

  if (!canAccessTramitacao) redirect("/");

  const comissaoIdsDoVereador = Array.from(
    new Set<string>([
      ...(user.profile?.vereador?.comissoes_membro?.map((c: { comissao_id: string }) => c.comissao_id) || []),
      ...(user.profile?.vereador?.comissoes_presididas?.map((c: { id: string }) => c.id) || []),
      ...(user.profile?.vereador?.comissoes_relatadas?.map((c: { id: string }) => c.id) || []),
    ])
  );

  const whereProposicoes: Record<string, unknown> = {
    tenant_id: user.profile.tenant_id,
    status: {
      in: ["PROTOCOLADO", "EM_TRAMITACAO", "AGUARDANDO_PARECER", "PRONTO_PARA_PAUTA", "EM_PAUTA"],
    },
  };

  if (isVereador) {
    const vereadorId = user.profile?.vereador?.id || "";
    const clauses: Array<Record<string, unknown>> = [
      { autor_id: vereadorId },
      { autoria_mesa: true },
    ];

    // Proposições em que o vereador participa como colaborador aceito.
    try {
      const colaboracoes = await prisma.$queryRaw<Array<{ proposicao_id: string }>>`
        SELECT proposicao_id
        FROM proposicao_colaboradores
        WHERE vereador_id = ${vereadorId}::uuid
          AND status = 'ACEITO'
      `;
      const colaboradorIds = colaboracoes.map((c) => c.proposicao_id).filter(Boolean);
      if (colaboradorIds.length > 0) {
        clauses.push({ id: { in: colaboradorIds } });
      }
    } catch {
      // Se a tabela de colaboradores não existir neste ambiente, seguimos com autor/comissão.
    }

    // Se fizer parte de comissão, também vê o que já foi direcionado para as comissões dele.
    if (vereadorComissaoAccess) {
      clauses.push({
        pareceres: {
          some: {
            tipo_parecer: "JURIDICO",
            comissao_id: { in: comissaoIdsDoVereador },
          },
        },
      });
    }

    whereProposicoes.OR = clauses;
  }

  const proposicaoInclude = {
    autor: { select: { nome_parlamentar: true } },
    pareceres: {
      where: { deleted_at: null },
      include: {
        autor: { select: { nome: true } },
      },
    },
    tramitacoes: {
      where: { deleted_at: null },
      include: {
        usuario: { select: { nome: true } },
        origem_setor: { select: { nome: true, sigla: true } },
        destino_setor: { select: { nome: true, sigla: true } },
      },
      orderBy: { created_at: "desc" as const },
    },
  };

  const tramitacaoStatusSql = isVereador
    ? Prisma.sql`AND status IN ('PROTOCOLADO', 'EM_TRAMITACAO', 'AGUARDANDO_PARECER', 'PRONTO_PARA_PAUTA', 'EM_PAUTA')`
    : undefined;

  const [proposicoesBase, comissoes, usuarios, setores] = await Promise.all([
    prisma.proposicao.findMany({
      where: whereProposicoes,
      include: proposicaoInclude,
      orderBy: { created_at: "desc" },
    }),
    getComissoes(),
    getUsuarios(),
    prisma.setor.findMany({
      where: {
        tenant_id: user.profile.tenant_id,
        deleted_at: null
      },
      orderBy: { nome: "asc" }
    })
  ]);

  const proposicoes = isVereador
    ? await mergeProposicoesComPoderExecutivo(
        user.profile.tenant_id,
        proposicoesBase,
        (ids) =>
          prisma.proposicao.findMany({
            where: { id: { in: ids } },
            include: proposicaoInclude,
          }),
        tramitacaoStatusSql,
      )
    : proposicoesBase;

  return (
    <AppLayout>
      <TramitacaoClient 
        initialProposicoes={proposicoes} 
        comissoes={comissoes}
        user={user}
        usuarios={usuarios}
        setores={setores}
      />
    </AppLayout>
  );
}
