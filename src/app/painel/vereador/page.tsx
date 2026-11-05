import { AppLayout } from "@/components/layout/AppLayout";
import { getProximaSessao } from "../actions";
import { PainelClient } from "../PainelClient";
import { getCurrentUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PainelVereadorPage() {
  const [sessao, user] = await Promise.all([
    getProximaSessao(),
    getCurrentUser()
  ]);

  return (
    <AppLayout hideSidebar={true}>
      <PainelClient
        key={sessao?.sessao?.id ?? "sem-sessao"}
        initialData={sessao}
        forcedView="vereador"
        userProfile={user?.profile}
      />
    </AppLayout>
  );
}
