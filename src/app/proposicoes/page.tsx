import { AppLayout } from "@/components/layout/AppLayout";
import { getProposicoes, getTiposProposicao } from "./actions";
import { getVereadores } from "../vereadores/actions";
import { getTenantConfig } from "../configuracoes/actions";
import { ProposicoesClient } from "./ProposicoesClient";
import { getCurrentUser } from "@/lib/dal";

// Força a página a carregar dados novos a cada acesso, ignorando caches antigos
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProposicoesPage() {
  const user = await getCurrentUser();
  const [proposicoes, tipos, vData, tenant] = await Promise.all([
    getProposicoes(),
    getTiposProposicao(),
    getVereadores(),
    getTenantConfig()
  ]);

  const vereadores = (vData as any).vereadores || [];

  return (
    <AppLayout>
      <ProposicoesClient 
        initialData={proposicoes} 
        tipos={tipos} 
        vereadores={vereadores}
        user={user}
        tenant={tenant}
      />
    </AppLayout>
  );
}
