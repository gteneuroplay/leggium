import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Gavel,
  Landmark,
  Layers,
  ShieldCheck,
  Sparkles,
  Tv,
  Vote,
} from "lucide-react";

const features = [
  {
    icon: Vote,
    title: "Painel plenário em tempo real",
    desc: "Votações, fila de oradores, presenças e cronómetro de tribuna alinhados ao operador.",
  },
  {
    icon: Landmark,
    title: "Mesa e presidentes",
    desc: "Fluxos pensados para a mesa diretora e para o comando dos trabalhos legislativos.",
  },
  {
    icon: CalendarDays,
    title: "Pautas e sessões",
    desc: "Organize sessões, ordem do dia e acompanhe o status de cada matéria em pauta.",
  },
  {
    icon: Gavel,
    title: "Proposições e tramitação",
    desc: "Protocolo, pareceres, comissões e histórico de despachos num só lugar.",
  },
  {
    icon: Tv,
    title: "Integração OBS",
    desc: "Overlays de oratória e brasão para transmissões, com dados atualizados do painel.",
  },
  {
    icon: Layers,
    title: "Multi-câmara",
    desc: "Uma plataforma para administrar instalações e subdomínios por município.",
  },
] as const;

const orcamentoHrefDefault =
  "mailto:contato@syslegis.com?subject=Or%C3%A7amento%20SysLegis&body=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20um%20or%C3%A7amento%20para%20a%20nossa%20c%C3%A2mara.";

export default function ProductLanding() {
  const hrefOrcamento =
    process.env.NEXT_PUBLIC_ORCAMENTO_URL?.trim() || orcamentoHrefDefault;
  const orcamentoAbreEmNovaAba = /^https?:\/\//i.test(hrefOrcamento);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-blue-600/25 blur-[120px]" />
        <div className="absolute right-[-120px] top-32 h-[480px] w-[480px] rounded-full bg-indigo-600/20 blur-[110px]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[100px]" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-white">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30">
              <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
            </span>
            Sys<span className="text-blue-400">Legis</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="#funcionalidades"
              className="hidden rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/5 sm:inline-block"
            >
              Funcionalidades
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
            >
              Entrar na plataforma
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="relative w-full overflow-hidden pb-20 pt-14 sm:pt-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0">
              <Image
                src="/hero.png"
                alt=""
                fill
                priority
                className="object-cover object-[center_22%] sm:object-center"
                sizes="100vw"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/92 via-slate-950/72 to-slate-950/96" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/82 via-slate-950/25 to-slate-950/82" />
          </div>

          <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              SaaS para Câmaras Municipais
            </p>
            <h1 className="mt-6 text-4xl font-black uppercase leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl md:text-6xl">
              Legislativo moderno,{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                do plenário ao protocolo
              </span>
            </h1>
            <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
              O SysLegis reúne painel de votação, oradores, pautas, proposições e tramitação numa experiência
              pensada para equipes de mesa, jurídico, secretaria e TI — com suporte a multi-domínios por câmara.
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-500"
              >
                Acessar o sistema
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10"
              >
                Ver funcionalidades
              </a>
            </div>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur-sm">
              <Building2 className="mx-auto h-8 w-8 text-blue-400" aria-hidden />
              <p className="mt-3 text-2xl font-black text-white">Multi-tenant</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Cada câmara no seu espaço seguro</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur-sm">
              <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" aria-hidden />
              <p className="mt-3 text-2xl font-black text-white">Controle de acesso</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Perfis, setores e permissões granulares</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur-sm sm:col-span-1">
              <Vote className="mx-auto h-8 w-8 text-violet-400" aria-hidden />
              <p className="mt-3 text-2xl font-black text-white">Tempo real</p>
              <p className="mt-1 text-xs font-medium text-slate-500">SSE e painéis sincronizados</p>
            </div>
          </div>
          </div>
        </section>

        <section id="funcionalidades" className="border-t border-white/10 bg-slate-950/80 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Tudo o que sua equipe precisa
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
              Do operador do painel ao vereador na bancada — menos papel, mais clareza e ritmo nas sessões.
            </p>
            <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, desc }) => (
                <li
                  key={title}
                  className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-lg"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-black uppercase tracking-wide text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/10 py-20">
          <div className="mx-auto max-w-3xl rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 via-slate-900/80 to-violet-600/20 px-6 py-14 text-center sm:px-10">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Pronto para digitalizar o plenário?
            </h2>
            <p className="mt-4 text-sm text-slate-300 sm:text-base">
              Solicite um orçamento sob medida ou entre diretamente se sua câmara já utiliza o SysLegis.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <a
                href={hrefOrcamento}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-black uppercase tracking-widest text-slate-950 shadow-xl transition hover:bg-slate-100"
                {...(orcamentoAbreEmNovaAba
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                Fazer orçamento
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                Entrar na plataforma
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-slate-950/90 py-10 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
        <p>© {new Date().getFullYear()} SysLegis · Gestão legislativa</p>
        <p className="mt-2 font-medium normal-case tracking-normal text-slate-600">
          <Link href="/login" className="text-blue-400 hover:underline">
            Entrar
          </Link>
          {" · "}
          <span className="text-slate-600">Subdomínios por câmara (ex.: sua-camara.syslegis.com)</span>
        </p>
      </footer>
    </div>
  );
}
