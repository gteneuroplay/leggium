"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/login/actions";
import { Loader2 } from "lucide-react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(login, null);

  useEffect(() => {
    if (state?.success) {
      router.push((state as { redirect?: string }).redirect || "/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium leading-6 text-slate-300"
        >
          E-mail ou Usuário
        </label>
        <div className="mt-2">
          <input
            id="email"
            name="email"
            type="text"
            required
            className="block w-full rounded-xl border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 premium-transition placeholder:text-slate-500"
            placeholder="seu@email.com ou usuario"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium leading-6 text-slate-300"
        >
          Senha
        </label>
        <div className="mt-2">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="block w-full rounded-xl border-0 bg-white/5 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 premium-transition placeholder:text-slate-500"
            placeholder="••••••••"
          />
        </div>
      </div>

      {state?.error && (
        <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-400">Erro ao entrar</h3>
              <div className="mt-2 text-sm text-red-300">
                <p>{state.error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full justify-center rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 premium-transition disabled:opacity-50 disabled:cursor-not-allowed items-center gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Entrando..." : "Entrar no Sistema"}
        </button>
      </div>
    </form>
  );
}
