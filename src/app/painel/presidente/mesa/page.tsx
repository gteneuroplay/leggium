import { AppLayout } from "@/components/layout/AppLayout";
import { prisma } from "@/lib/prisma";
import { verifyPresidenteMesaToken } from "@/lib/painel/presidente-mesa-token";
import { getPainelDataPresidenteMesa } from "../../actions";
import { PainelClient } from "../../PainelClient";

export const dynamic = "force-dynamic";

export default async function PainelPresidenteMesaPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.trim() : "";

  if (!token) {
    return (
      <AppLayout hideSidebar={true}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-foreground">Painel da mesa</h1>
          <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
            Este endereço deve incluir o código de segurança no final do link. Peça ao operador da sessão o
            link completo; assim a presidência pode acompanhar a pauta e a votação sem iniciar sessão neste
            computador.
          </p>
        </div>
      </AppLayout>
    );
  }

  const verified = verifyPresidenteMesaToken(token);
  if (!verified) {
    return (
      <AppLayout hideSidebar={true}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight text-destructive">Ligação inválida ou expirada</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            O operador pode gerar um novo link seguro no painel da operação (sessão ativa).
          </p>
        </div>
      </AppLayout>
    );
  }

  let bundle: Awaited<ReturnType<typeof getPainelDataPresidenteMesa>>;
  try {
    bundle = await getPainelDataPresidenteMesa(verified.sessaoId, token);
  } catch {
    return (
      <AppLayout hideSidebar={true}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-bold text-destructive">Não foi possível carregar os dados da sessão.</p>
        </div>
      </AppLayout>
    );
  }

  const vereadores = await prisma.vereador.findMany({
    where: { tenant_id: verified.tenantId },
    orderBy: { nome_parlamentar: "asc" },
  });

  const initialData = {
    ...bundle,
    vereadores: vereadores || [],
  };

  return (
    <AppLayout hideSidebar={true}>
      <PainelClient
        key={bundle.sessao?.id ?? "sem-sessao"}
        initialData={initialData}
        forcedView="presidente"
        mesaToken={token}
      />
    </AppLayout>
  );
}
