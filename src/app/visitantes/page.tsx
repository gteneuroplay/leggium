import { AppLayout } from "@/components/layout/AppLayout";
import { getVisitantes } from "./actions";
import { getVereadores } from "../vereadores/actions";
import { VisitantesClient } from "./VisitantesClient";

export const metadata = {
  title: "Visitantes | SysLegis",
};

export default async function VisitantesPage() {
  const [visitantes, vData] = await Promise.all([
    getVisitantes(),
    getVereadores()
  ]);

  const vereadores = (vData as any).vereadores || [];

  return (
    <AppLayout>
      {/* @ts-ignore */}
      <VisitantesClient initialData={visitantes} vereadores={vereadores} />
    </AppLayout>

  );
}
