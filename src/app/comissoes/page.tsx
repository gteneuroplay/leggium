import { AppLayout } from "@/components/layout/AppLayout";
import { getComissoes } from "./actions";
import { getVereadores } from "../vereadores/actions";
import { ComissoesClient } from "./ComissoesClient";

export const metadata = {
  title: "Comissões | SysLegis",
};

export default async function ComissoesPage() {
  const [comissoes, vereadoresData] = await Promise.all([
    getComissoes(),
    getVereadores()
  ]);

  const { vereadores } = vereadoresData as any;

  return (
    <AppLayout>
      <ComissoesClient 
        initialData={comissoes} 
        vereadores={vereadores}
      />
    </AppLayout>
  );
}
