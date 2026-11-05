import { AppLayout } from "@/components/layout/AppLayout";
import { getSessoes } from "./actions";
import { SessoesClient } from "./SessoesClient";

export default async function SessoesPage() {
  const sessoes = await getSessoes();

  return (
    <AppLayout>
      <SessoesClient initialData={sessoes} />
    </AppLayout>
  );
}
