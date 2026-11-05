import { AppLayout } from "@/components/layout/AppLayout";
import { getBancadas } from "./actions";
import { BancadasClient } from "./BancadasClient";

export const metadata = {
  title: "Bancadas e Partidos | SysLegis",
};

export default async function BancadasPage() {
  const data = await getBancadas();

  return (
    <AppLayout>
      <BancadasClient initialData={data} />
    </AppLayout>
  );
}
