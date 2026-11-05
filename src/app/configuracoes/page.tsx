import { AppLayout } from "@/components/layout/AppLayout";
import { getTenantConfig } from "./actions";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export const metadata = {
  title: "Configurações | SysLegis",
};

export default async function ConfiguracoesPage() {
  const config = await getTenantConfig();

  return (
    <AppLayout>
      <ConfiguracoesClient initialData={config} />
    </AppLayout>
  );
}
