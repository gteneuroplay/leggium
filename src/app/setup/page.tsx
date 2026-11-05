import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sparkles, Rocket } from "lucide-react";
import { hashPassword } from "@/lib/auth/password";
import { ensureDefaultBancadasForTenant } from "@/lib/bootstrap/default-bancadas";
import { ensureDefaultProposicaoTiposForTenant } from "@/lib/bootstrap/default-proposicao-tipos";
import { ensureDefaultSetoresForTenant } from "@/lib/bootstrap/default-setores";

/** Nunca pré-renderizar no build (Docker/CI sem Postgres). */
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: "camara-aracaju" },
    select: { id: true },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        nome_camara: "Câmara Municipal de Aracaju",
        slug: "camara-aracaju",
        cidade: "Aracaju",
        uf: "SE",
      },
      select: { id: true },
    });
  }

  if (tenant?.id) {
    await ensureDefaultSetoresForTenant(tenant.id);
    await ensureDefaultBancadasForTenant(tenant.id);
    await ensureDefaultProposicaoTiposForTenant(tenant.id);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 relative overflow-hidden">
       {/* Decoração de Fundo */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-blue-500 to-indigo-600 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="premium-panel p-12 max-w-xl w-full text-center rounded-xl border border-border shadow-2xl relative z-10">
        <div className="inline-flex p-6 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 shadow-2xl shadow-emerald-600/20 mb-8 border border-white/10">
           <Rocket className="h-10 w-10 text-white" />
        </div>
        
        <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-4">Primeiros Passos</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-10 max-w-sm mx-auto leading-relaxed">
          Configure as credenciais mestras para iniciar a operação do <span className="text-blue-600">SysLegis</span> em sua unidade.
        </p>

        <form action={async (formData) => {
          "use server";
          const email = formData.get("email") as string;
          const password = formData.get("password") as string;
          const tenant = await prisma.tenant.findUnique({
            where: { slug: "camara-aracaju" },
            select: { id: true }
          });

          if (!tenant?.id) {
            throw new Error("Tenant padrão não encontrado.");
          }

          const userId = crypto.randomUUID();
          const senhaHash = await hashPassword(password);

          await prisma.user.upsert({
            where: { email },
            update: {
              tenant_id: tenant.id,
              nome: "Administrador Master",
              role: "ADMIN_MASTER",
              username: "admin.master",
              status: true
            },
            create: {
              id: userId,
              tenant_id: tenant.id,
              nome: "Administrador Master",
              email,
              role: "ADMIN_MASTER",
              username: "admin.master",
              status: true
            }
          });
          await prisma.$executeRaw`
            UPDATE users
            SET senha_hash = ${senhaHash}
            WHERE email = ${email}
          `;

          redirect("/login");
        }} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">E-mail Administrativo</label>
            <input 
              name="email" 
              type="email" 
              placeholder="E-mail" 
              defaultValue="admin@example.com"
              className="w-full premium-input rounded-xl py-4 px-6 shadow-lg font-bold"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Senha de Acesso</label>
            <input 
              name="password" 
              type="password" 
              placeholder="Senha" 
              defaultValue="admin123"
              className="w-full premium-input rounded-xl py-4 px-6 shadow-lg font-bold"
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-5 rounded-xl transition-all shadow-2xl shadow-blue-600/20 active:scale-95 mt-4 flex items-center justify-center gap-3">
            <Sparkles size={20} />
            Finalizar Configuração
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-border flex justify-center gap-6 opacity-30">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Database Sync</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Auth Ready</span>
            </div>
        </div>
      </div>
    </div>
  );
}
