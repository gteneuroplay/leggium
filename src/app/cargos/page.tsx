import { AppLayout } from "@/components/layout/AppLayout";
import { getCargos } from "./actions";
import { CargosClient } from "./CargosClient";

export const metadata = {
  title: "Cargos e Permissões | SysLegis",
};

export default async function CargosPage() {
  const data = await getCargos();

  return (
    <AppLayout>
      <CargosClient initialData={data} />
    </AppLayout>
  );
}
