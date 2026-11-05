import { LoginForm } from "@/components/auth/LoginForm";
import { ShieldCheck } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col justify-center py-12 px-6 lg:px-8 bg-background relative overflow-hidden">
      {/* Decoração de Fundo Premium */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-10 dark:opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex p-5 rounded-xl bg-blue-600 shadow-2xl shadow-blue-600/20 mb-8 border border-white/10 group hover:scale-110 transition-transform duration-500">
           <ShieldCheck className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase leading-tight sm:text-4xl md:text-5xl">
          Sys<span className="text-blue-600">Legis</span>
        </h2>
        <p className="mt-3 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">
          Plataforma de Gestão Legislativa
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="premium-panel rounded-xl border border-border px-4 py-8 shadow-2xl sm:px-10 sm:py-10 md:px-12">
          <div className="mb-8 text-center sm:text-left">
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Bem-vindo de volta</h3>
            <p className="text-slate-500 font-medium text-xs mt-1">Identifique-se para acessar o painel administrativo.</p>
          </div>
          <LoginForm nextPath={next} />
          
          <div className="mt-10 pt-8 border-t border-border flex flex-col items-center gap-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 SysLegis</p>
             <div className="flex gap-4 opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
