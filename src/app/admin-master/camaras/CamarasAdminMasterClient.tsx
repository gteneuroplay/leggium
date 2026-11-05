"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Save, Server, Users, Gavel, FileText, CalendarDays, Copy, ShieldCheck, Lock, Globe, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  entrarNaInstalacaoCamara,
  limparContextoInstalacaoMaster,
} from "@/app/plataforma/actions";
import {
  criarCamaraAdminMaster,
  provisionarCamaraNaVps,
  ativarSslCamaraNaVps,
  validarDnsCamara,
  garantirSubdominioCadastrado,
} from "./actions";

type Camara = {
  id: string;
  nome_camara: string;
  slug: string;
  cidade: string;
  uf: string;
  created_at: string;
  settings?: any;
  _count?: {
    users: number;
    vereadores: number;
    proposicoes: number;
    sessoes: number;
  };
};

export function CamarasAdminMasterClient({
  initialData,
  showHeader = true,
  variant = "default",
  appBaseDomain = "syslegis.com",
}: {
  initialData: Camara[];
  /** Quando false, omite o título duplicado (ex.: painel master unificado). */
  showHeader?: boolean;
  /** Em `plataforma`, exibe ação para abrir o dashboard no subdomínio da câmara (produção). */
  variant?: "default" | "plataforma";
  /** Mesmo valor que `APP_BASE_DOMAIN` no servidor (ex.: syslegis.com). */
  appBaseDomain?: string;
}) {
  const router = useRouter();
  const [entrandoId, setEntrandoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [sslId, setSslId] = useState<string | null>(null);
  const [dnsId, setDnsId] = useState<string | null>(null);
  const [syncSubId, setSyncSubId] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [infraHint, setInfraHint] = useState<{ host: string; snippet: string } | null>(null);
  const [logByTenantId, setLogByTenantId] = useState<Record<string, string>>({});
  const [dnsByTenantId, setDnsByTenantId] = useState<Record<string, { message: string; ok: boolean }>>({});
  const [formData, setFormData] = useState({
    nome_camara: "",
    slug: "",
    cidade: "",
    uf: "",
    admin_nome: "",
    admin_email: "",
    admin_password: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await criarCamaraAdminMaster(formData);
      setInfraHint({ host: res.subdomainHost, snippet: res.nginxSnippet });
      toast.success("Câmara criada com sucesso.");
      setFormData({
        nome_camara: "",
        slug: "",
        cidade: "",
        uf: "",
        admin_nome: "",
        admin_email: "",
        admin_password: "",
      });
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível criar a Câmara.");
    } finally {
      setIsSaving(false);
    }
  };

  const copySnippet = async () => {
    if (!infraHint?.snippet) return;
    await navigator.clipboard.writeText(infraHint.snippet);
    toast.success("Snippet Nginx copiado.");
  };

  const apexBase = appBaseDomain.replace(/^www\./i, "");

  const subdominioDashboardHost = (camara: Camara) =>
    String((camara.settings as any)?.infra?.subdomain_host || "").trim() ||
    `${camara.slug}.${apexBase}`;

  const abrirDashboardInstalacao = async (camara: Camara) => {
    setEntrandoId(camara.id);
    try {
      const host = subdominioDashboardHost(camara);
      const { hostname, protocol } = window.location;
      const onLocalDev =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".local");

      if (onLocalDev) {
        await entrarNaInstalacaoCamara(camara.id);
        toast.success("Abrindo o dashboard desta câmara (modo local)…");
        router.push("/");
        router.refresh();
        return;
      }

      await limparContextoInstalacaoMaster();
      const proto =
        protocol === "http:" &&
        (hostname === "localhost" || hostname === "127.0.0.1")
          ? "http"
          : "https";
      window.location.assign(`${proto}://${host}/`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o dashboard.");
    } finally {
      setEntrandoId(null);
    }
  };

  const handleProvision = async (tenantId: string) => {
    setProvisioningId(tenantId);
    try {
      const res = await provisionarCamaraNaVps(tenantId);
      setLogByTenantId((prev) => ({ ...prev, [tenantId]: res.log || "" }));
      toast.success("Provisionamento Nginx concluído.");
    } catch (e: any) {
      toast.error(e?.message || "Falha no provisionamento.");
    } finally {
      setProvisioningId(null);
    }
  };

  const handleSsl = async (tenantId: string) => {
    setSslId(tenantId);
    try {
      const res = await ativarSslCamaraNaVps(tenantId);
      setLogByTenantId((prev) => ({ ...prev, [tenantId]: res.log || "" }));
      toast.success("SSL ativado com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ativar SSL.");
    } finally {
      setSslId(null);
    }
  };

  const handleSyncSubdominio = async (tenantId: string) => {
    setSyncSubId(tenantId);
    try {
      const res = await garantirSubdominioCadastrado(tenantId);
      toast.success(`Subdomínio registrado: ${res.subdomainHost}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao registrar subdomínio.");
    } finally {
      setSyncSubId(null);
    }
  };

  const handleInfraPipeline = async (tenantId: string) => {
    setPipelineId(tenantId);
    try {
      const dns = await validarDnsCamara(tenantId);
      setDnsByTenantId((prev) => ({
        ...prev,
        [tenantId]: { message: dns.message, ok: Boolean(dns.matched) },
      }));
      if (!dns.matched) {
        toast.error(
          "DNS ainda não aponta para a VPS. Crie o registro A (ou CNAME) no registrador e use Validar DNS antes de continuar."
        );
        return;
      }
      toast.success("DNS ok. Provisionando Nginx…");
      const prov = await provisionarCamaraNaVps(tenantId);
      setLogByTenantId((prev) => ({ ...prev, [tenantId]: prov.log || "" }));
      toast.success("Nginx ok. Ativando SSL…");
      const ssl = await ativarSslCamaraNaVps(tenantId);
      setLogByTenantId((prev) => ({ ...prev, [tenantId]: ssl.log || "" }));
      toast.success("Fluxo concluído: DNS, Nginx e SSL.");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Falha no fluxo automático.");
    } finally {
      setPipelineId(null);
    }
  };

  const handleDns = async (tenantId: string) => {
    setDnsId(tenantId);
    try {
      const res = await validarDnsCamara(tenantId);
      setDnsByTenantId((prev) => ({
        ...prev,
        [tenantId]: { message: res.message, ok: Boolean(res.matched) },
      }));
      if (res.matched) toast.success("DNS validado com sucesso.");
      else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao validar DNS.");
    } finally {
      setDnsId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {showHeader ? (
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Building2 className="h-7 w-7 text-blue-600" />
            Gestão de câmaras e infraestrutura
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">
            Criação de tenants, subdomínios, Nginx na VPS e SSL (Certbot).
          </p>
        </div>
      ) : null}

      <div className="premium-panel rounded-xl border border-border p-6">
        <h2 className="text-lg font-black text-foreground mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-600" />
          Nova Câmara
        </h2>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="premium-input rounded-xl px-4 py-3 font-bold" placeholder="Nome da Câmara" required value={formData.nome_camara} onChange={(e) => setFormData({ ...formData, nome_camara: e.target.value })} />
          <input className="premium-input rounded-xl px-4 py-3 font-bold" placeholder="Slug (ex: camara-olinda)" required value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
          <input className="premium-input rounded-xl px-4 py-3 font-bold" placeholder="Cidade" required value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} />
          <input className="premium-input rounded-xl px-4 py-3 font-bold" placeholder="UF" required maxLength={2} value={formData.uf} onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })} />
          <input className="premium-input rounded-xl px-4 py-3 font-bold" placeholder="Nome do Admin da Câmara" required value={formData.admin_nome} onChange={(e) => setFormData({ ...formData, admin_nome: e.target.value })} />
          <input className="premium-input rounded-xl px-4 py-3 font-bold" type="email" placeholder="E-mail do Admin da Câmara" required value={formData.admin_email} onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })} />
          <input className="premium-input rounded-xl px-4 py-3 font-bold md:col-span-2" type="password" placeholder="Senha inicial do Admin da Câmara" required value={formData.admin_password} onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })} />
          <button type="submit" disabled={isSaving} className="md:col-span-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-3 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {isSaving ? "Criando..." : "Criar Câmara"}
          </button>
        </form>

        {infraHint && (
          <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-600/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Subdomínio provisionado logicamente
            </p>
            <p className="text-sm font-bold text-foreground mb-3">{infraHint.host}</p>
            <div className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs font-mono whitespace-pre-wrap">
              {infraHint.snippet}
            </div>
            <button onClick={copySnippet} className="mt-3 rounded-lg border border-border bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-white/10 flex items-center gap-2">
              <Copy className="h-3.5 w-3.5" />
              Copiar snippet Nginx
            </button>
          </div>
        )}
      </div>

      <div className="premium-panel rounded-xl border border-border p-6">
        <h2 className="text-lg font-black text-foreground mb-4">Câmaras cadastradas</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {initialData.map((camara) => (
            <div key={camara.id} className="rounded-xl border border-border bg-slate-50 dark:bg-white/5 p-4">
              <p className="text-lg font-black text-foreground">{camara.nome_camara}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                {camara.slug} • {camara.cidade}/{camara.uf}
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-black mt-2">
                {subdominioDashboardHost(camara)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-wider">
                <div className="rounded-lg border border-border px-2 py-1 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {camara._count?.users || 0} usuários</div>
                <div className="rounded-lg border border-border px-2 py-1 flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5" /> {camara._count?.vereadores || 0} vereadores</div>
                <div className="rounded-lg border border-border px-2 py-1 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {camara._count?.proposicoes || 0} proposições</div>
                <div className="rounded-lg border border-border px-2 py-1 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {camara._count?.sessoes || 0} sessões</div>
              </div>
              {variant === "plataforma" ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => abrirDashboardInstalacao(camara)}
                    disabled={entrandoId === camara.id}
                    className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {entrandoId === camara.id ? "Abrindo…" : "Abrir dashboard (subdomínio)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInfraPipeline(camara.id)}
                    disabled={pipelineId === camara.id}
                    className="w-full rounded-lg border border-violet-500/40 bg-violet-600 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {pipelineId === camara.id ? "Executando…" : "Preparar site no ar (DNS → Nginx → SSL)"}
                  </button>
                  <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 px-0.5">
                    No registrador, crie o registo DNS (A ou CNAME) deste host para o IP da VPS. Depois use o botão acima; só abra os passos manuais se precisar corrigir um passo isolado.
                  </p>
                  <details className="group rounded-lg border border-white/10 bg-black/[0.03] dark:bg-white/[0.04] open:pb-2">
                    <summary className="cursor-pointer select-none list-none px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 [&::-webkit-details-marker]:hidden">
                      Passos manuais e cadastro
                    </summary>
                    <div className="space-y-2 border-t border-white/10 px-2 pb-2 pt-2">
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        «Registrar subdomínio» grava o host no banco (útil para câmaras antigas ou importadas sem infra). Os três botões abaixo repetem o que o fluxo automático faz, um de cada vez.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSyncSubdominio(camara.id)}
                        disabled={syncSubId === camara.id}
                        className="w-full rounded-lg border border-slate-500/30 bg-slate-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-600 hover:text-white transition-all disabled:opacity-50"
                      >
                        {syncSubId === camara.id ? "Gravando…" : "Registrar subdomínio no cadastro"}
                      </button>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => handleDns(camara.id)}
                          disabled={dnsId === camara.id}
                          className="rounded-lg border border-amber-500/30 bg-amber-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          {dnsId === camara.id ? "Validando..." : "Validar DNS"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProvision(camara.id)}
                          disabled={provisioningId === camara.id}
                          className="rounded-lg border border-blue-500/30 bg-blue-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {provisioningId === camara.id ? "Provisionando..." : "Nginx na VPS"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSsl(camara.id)}
                          disabled={sslId === camara.id}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {sslId === camara.id ? "Ativando SSL..." : "SSL (Certbot)"}
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleDns(camara.id)}
                    disabled={dnsId === camara.id}
                    className="rounded-lg border border-amber-500/30 bg-amber-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {dnsId === camara.id ? "Validando..." : "Validar DNS"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProvision(camara.id)}
                    disabled={provisioningId === camara.id}
                    className="rounded-lg border border-blue-500/30 bg-blue-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {provisioningId === camara.id ? "Provisionando..." : "Provisionar VPS"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSsl(camara.id)}
                    disabled={sslId === camara.id}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-600/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {sslId === camara.id ? "Ativando SSL..." : "Ativar SSL"}
                  </button>
                </div>
              )}
              {(dnsByTenantId[camara.id] || (camara.settings as any)?.infra?.dns_message) && (
                <div className={`mt-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${
                  (dnsByTenantId[camara.id]?.ok ?? ((camara.settings as any)?.infra?.dns_status === "OK"))
                    ? "border-emerald-500/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                    : "border-red-500/30 bg-red-600/10 text-red-700 dark:text-red-300"
                }`}>
                  {dnsByTenantId[camara.id]?.message || (camara.settings as any)?.infra?.dns_message}
                </div>
              )}
              {(logByTenantId[camara.id] || (camara.settings as any)?.infra?.provision_log_last) && (
                <div className="mt-3 rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-44 overflow-y-auto">
                  {logByTenantId[camara.id] || (camara.settings as any)?.infra?.provision_log_last}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
