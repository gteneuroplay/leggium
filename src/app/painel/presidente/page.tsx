import { AppLayout } from "@/components/layout/AppLayout";
import { getCurrentUser } from "@/lib/dal";
import { getProximaSessao } from "../actions";
import { PainelClient } from "../PainelClient";

export const dynamic = "force-dynamic";

export default async function PainelPresidentePage() {
  const [sessao, user] = await Promise.all([getProximaSessao(), getCurrentUser()]);

  return (
    <AppLayout hideSidebar={true}>
      <PainelClient
        key={sessao?.sessao?.id ?? "sem-sessao"}
        initialData={sessao}
        forcedView="presidente"
        userProfile={user?.profile}
      />
    </AppLayout>
  );
}
