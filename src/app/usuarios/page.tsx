import { AppLayout } from "@/components/layout/AppLayout";
import { getUsuarios } from "./actions";
import { UsuariosClient } from "./UsuariosClient";
import { getSetores } from "../setores/actions";

export default async function UsuariosPage() {
  const [usuarios, setores] = await Promise.all([
    getUsuarios(),
    getSetores(),
  ]);

  return (
    <AppLayout>
      <UsuariosClient initialData={usuarios} setores={setores} />
    </AppLayout>
  );
}
