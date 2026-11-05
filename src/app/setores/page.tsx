import { getSetores } from "./actions";
import { SetoresClient } from "./SetoresClient";

export const metadata = {
  title: "Setores | SysLegis",
};

import { AppLayout } from "@/components/layout/AppLayout";

export default async function SetoresPage() {
  const data = await getSetores();

  return (
    <AppLayout>
      <SetoresClient initialData={data} />
    </AppLayout>
  );
}
