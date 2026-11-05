import { AppLayout } from "@/components/layout/AppLayout";
import { getProximaSessao } from "../actions";
import { PainelClient } from "../PainelClient";

export const dynamic = "force-dynamic";

export default async function PainelTVPage() {
  const sessao = await getProximaSessao();

  return (
    <AppLayout hideSidebar={true}>
      <PainelClient
        key={sessao?.sessao?.id ?? "sem-sessao"}
        initialData={sessao}
        forcedView="tv"
      />
    </AppLayout>
  );
}
