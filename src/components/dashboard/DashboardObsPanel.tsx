"use client";

import { useMemo, useState } from "react";
import { Copy, Check, ExternalLink, Video } from "lucide-react";
import { toast } from "react-hot-toast";

export type SessaoOption = {
  id: string;
  label: string;
  status: string;
};

/** Caminho relativo (mesmo no servidor e no cliente — evita hydration mismatch). */
function overlayPathOratoria(sessaoId: string) {
  return `/obs/overlay/oratoria?sessaoId=${encodeURIComponent(sessaoId)}`;
}

function toAbsoluteForClipboard(path: string) {
  if (!path.startsWith("/")) return path;
  return `${window.location.origin}${path}`;
}

export function DashboardObsPanel({
  sessoes,
  defaultSessaoId,
}: {
  sessoes: SessaoOption[];
  defaultSessaoId: string | null;
}) {
  const [sessaoId, setSessaoId] = useState<string>(() => defaultSessaoId || sessoes[0]?.id || "");
  const [copied, setCopied] = useState<string | null>(null);

  const oratoriaPath = useMemo(() => (sessaoId ? overlayPathOratoria(sessaoId) : ""), [sessaoId]);
  const brasaoPath = "/obs/overlay/brasao";

  const copy = async (key: string, path: string) => {
    if (!path) {
      toast.error("Selecione uma sessão.");
      return;
    }
    try {
      const text = toAbsoluteForClipboard(path);
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
      toast.success("URL copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="premium-panel rounded-xl border border-border p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-400">
            <Video className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground sm:text-2xl">
              Integração OBS
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Adicione cada endereço como <strong className="text-foreground">Fonte de navegador</strong> no OBS,
              por cima do vídeo da câmara. Ative <strong className="text-foreground">fundo transparente</strong> na
              fonte. Os overlays são modulares: um para a oratória (rodapé) e outro só para o brasão (canto superior
              direito). O conteúdo acompanha o operador do painel em tempo real.
            </p>
            <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400/90">
              Use as URLs abaixo diretamente no OBS (fonte de navegador). Se pedir login, após entrar você volta ao
              overlay — não ao dashboard. Contas só de transmissão abrem esta página ao logar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Sessão (overlays que dependem do plenário)
          </span>
          <select
            value={sessaoId}
            onChange={(e) => setSessaoId(e.target.value)}
            className="w-full max-w-xl rounded-lg border border-border bg-background px-4 py-3 text-sm font-bold text-foreground shadow-inner"
          >
            {sessoes.length === 0 ? (
              <option value="">Nenhuma sessão cadastrada</option>
            ) : (
              sessoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.status}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="premium-panel flex flex-col rounded-xl border border-border p-5 shadow-xl sm:p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Oratória (rodapé)
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Nome, foto, partido (vereador), cargo na mesa ou representação (visitante) e tempo oficial de fala.
            Abaixo, faixa fina em toda a largura da tela, discreta, com a matéria em pauta em rolagem horizontal. Transição suave quando o operador troca o orador.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy("oratoria", oratoriaPath)}
              disabled={!oratoriaPath}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-blue-500 disabled:opacity-40"
            >
              {copied === "oratoria" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar URL
            </button>
            {oratoriaPath ? (
              <a
                href={oratoriaPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-black uppercase tracking-widest text-foreground hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir
              </a>
            ) : null}
          </div>
          <code className="mt-4 block max-h-24 overflow-auto rounded-lg border border-border bg-slate-950/80 p-3 text-[11px] text-blue-200">
            {oratoriaPath || "—"}
          </code>
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/80">
            {oratoriaPath ? (
              <iframe title="Pré-visualização oratória" src={oratoriaPath} className="h-full w-full scale-90 bg-transparent" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">Sem sessão</div>
            )}
          </div>
        </section>

        <section className="premium-panel flex flex-col rounded-xl border border-border p-5 shadow-xl sm:p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
            Brasão (canto superior direito)
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Logo da câmara (<code className="text-foreground">brasao_url</code> do tenant). Se não houver imagem,
            exibe o nome da câmara.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy("brasao", brasaoPath)}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-violet-500"
            >
              {copied === "brasao" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar URL
            </button>
            <a
              href={brasaoPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-black uppercase tracking-widest text-foreground hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir
            </a>
          </div>
          <code className="mt-4 block max-h-24 overflow-auto rounded-lg border border-border bg-slate-950/80 p-3 text-[11px] text-violet-200">
            {brasaoPath}
          </code>
          <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg border border-border bg-gradient-to-br from-slate-900 to-slate-950">
            <iframe title="Pré-visualização brasão" src={brasaoPath} className="h-full w-full bg-transparent" />
          </div>
        </section>
      </div>
    </div>
  );
}
