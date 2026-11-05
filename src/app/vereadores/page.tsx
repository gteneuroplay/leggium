import { AppLayout } from "@/components/layout/AppLayout";
import { getVereadores, getBancadas } from "./actions";
import { VereadoresClient } from "./VereadoresClient";

export const metadata = {
  title: "Vereadores | SysLegis",
};

export default async function VereadoresPage() {
  const [data, bancadas] = await Promise.all([
    getVereadores(),
    getBancadas()
  ]);

  const { vereadores, settings } = data as any;

  return (
    <AppLayout>
      <VereadoresClient 
        initialData={vereadores} 
        bancadas={bancadas} 
        settings={settings}
      />
    </AppLayout>
  );
}
