import { AppLayout } from "@/components/layout/AppLayout";
import { getSessoes, getProposicoesProntasParaPauta } from "../sessoes/actions";
import { getTiposProposicao } from "../proposicoes/actions";
import { getVereadores } from "../vereadores/actions";
import { getCurrentUser } from "@/lib/dal";
import { PautasClient } from "./PautasClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestão de Pautas | SysLegis",
};

export default async function PautasPage() {
  const user = await getCurrentUser();
  const [sessoes, proposicoesProntas, vData, tipos] = await Promise.all([
    getSessoes(),
    getProposicoesProntasParaPauta(),
    getVereadores(),
    getTiposProposicao(),
  ]);

  // Filtramos apenas as sessões que não estão encerradas
  const sessoesAtivas = sessoes.filter((s: any) => s.status !== 'ENCERRADA');
  const vereadores = (vData as { vereadores?: unknown[] }).vereadores ?? [];

  return (
    <AppLayout>
      <PautasClient 
        initialSessoes={sessoesAtivas} 
        proposicoesProntas={proposicoesProntas}
        vereadores={vereadores as any[]}
        tipos={tipos}
        user={user}
      />
    </AppLayout>
  );
}
