"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { resolve4 } from "node:dns/promises";
import { spawn } from "node:child_process";
import { ensureDefaultSetoresForTenant } from "@/lib/bootstrap/default-setores";
import { ensureDefaultBancadasForTenant } from "@/lib/bootstrap/default-bancadas";
import { ensureDefaultProposicaoTiposForTenant } from "@/lib/bootstrap/default-proposicao-tipos";

function assertAdminMaster(user: any) {
  if (!user?.profile?.role || user.profile.role !== "ADMIN_MASTER") {
    throw new Error("Acesso restrito ao Admin Master.");
  }
}

function normalizeSlug(input: string) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Destino SSH: PROVISION_SSH_TARGET (ex.: root@host.docker.internal no Compose) ou PROVISION_SSH_ALIAS (ex.: vps-syslegis no laptop). */
function getSshTarget() {
  return (
    process.env.PROVISION_SSH_TARGET?.trim() ||
    process.env.PROVISION_SSH_ALIAS?.trim() ||
    "vps-syslegis"
  );
}

/**
 * Executa um script bash no destino SSH via `ssh target bash -s` (stdin).
 * Evita `bash -lc "..."` com heredocs/variáveis Nginx (`$host`) partidos por aspas ou `;`.
 */
async function runSsh(script: string) {
  const target = getSshTarget();
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "UserKnownHostsFile=/root/.ssh/known_hosts",
    target,
    "bash",
    "-s",
  ];
  const body = script.endsWith("\n") ? script : `${script}\n`;
  try {
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn("ssh", args, {
          env: { ...process.env, HOME: process.env.HOME || "/root" },
          timeout: 120_000,
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", (c) => {
          stdout += c;
        });
        child.stderr?.on("data", (c) => {
          stderr += c;
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code !== 0) {
            const err = new Error(stderr.trim() || stdout.trim() || `ssh exit ${code}`) as Error & {
              code: number;
            };
            err.code = code ?? -1;
            reject(err);
          } else resolve({ stdout, stderr });
        });
        child.stdin?.write(body);
        child.stdin?.end();
      }
    );
    return `${stdout || ""}${stderr ? `\n${stderr}` : ""}`.trim();
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { stderr?: string };
    if (err?.code === "ENOENT") {
      throw new Error(
        "Comando «ssh» não encontrado na imagem. Reconstrua a imagem (openssh-client no Dockerfile)."
      );
    }
    const msg = [err?.message, err?.stderr].filter(Boolean).join("\n");
    throw new Error(
      msg ||
        "Falha ao executar SSH. Em Docker na VPS defina PROVISION_SSH_TARGET=root@host.docker.internal, extra_hosts no compose e chave em /root/.ssh (veja deploy/env.docker.example)."
    );
  }
}

export async function getCamarasAdminMaster() {
  const user = await getCurrentUser();
  assertAdminMaster(user);

  const camaras = await prisma.tenant.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          vereadores: true,
          proposicoes: true,
          sessoes: true,
        },
      },
    },
  });

  return camaras;
}

export async function criarCamaraAdminMaster(formData: {
  nome_camara: string;
  slug: string;
  cidade: string;
  uf: string;
  admin_nome: string;
  admin_email: string;
  admin_password: string;
}) {
  const user = await getCurrentUser();
  assertAdminMaster(user);

  const slug = normalizeSlug(formData.slug);
  if (!slug || slug.length < 3) {
    throw new Error("Slug inválido. Use ao menos 3 caracteres (a-z, 0-9 e hífen).");
  }

  const uf = String(formData.uf || "").trim().toUpperCase();
  if (uf.length !== 2) throw new Error("UF inválida. Informe 2 letras.");

  const tenantId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const adminPasswordHash = await hashPassword(formData.admin_password);

  const existingSlug = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (existingSlug?.id) throw new Error("Já existe uma Câmara com esse slug.");

  const existingEmail = await prisma.user.findUnique({
    where: { email: String(formData.admin_email || "").trim().toLowerCase() },
    select: { id: true },
  });
  if (existingEmail?.id) throw new Error("Já existe usuário com esse e-mail.");

  const baseDomain = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const apex = baseDomain.replace(/^www\./i, "");
  const subdomainHost = `${slug}.${apex}`;

  await prisma.$transaction(async (tx: any) => {
    await tx.tenant.create({
      data: {
        id: tenantId,
        nome_camara: formData.nome_camara.trim(),
        slug,
        cidade: formData.cidade.trim(),
        uf,
        settings: {
          infra: {
            subdomain_host: subdomainHost,
            app_target_port: Number(process.env.APP_PORT || 3000),
          },
        } as any,
      },
    });

    await tx.user.create({
      data: {
        id: adminUserId,
        tenant_id: tenantId,
        nome: formData.admin_nome.trim(),
        email: formData.admin_email.trim().toLowerCase(),
        username: normalizeSlug(formData.admin_nome) || `admin-${slug}`,
        senha_hash: adminPasswordHash,
        role: "ADMIN_CAMARA",
        status: true,
      },
    });
  });

  await ensureDefaultSetoresForTenant(tenantId);
  await ensureDefaultBancadasForTenant(tenantId);
  await ensureDefaultProposicaoTiposForTenant(tenantId);

  revalidatePath("/plataforma");
  revalidatePath("/admin-master/camaras");
  return {
    success: true,
    tenantId,
    subdomainHost,
    nginxSnippet: [
      `server_name ${subdomainHost};`,
      "client_max_body_size 50m;",
      "location / {",
      "  proxy_pass http://127.0.0.1:3000;",
      "  proxy_set_header Host $host;",
      "  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "  proxy_read_timeout 300s;",
      "}",
    ].join("\n"),
  };
}

export async function provisionarCamaraNaVps(tenantId: string) {
  const user = await getCurrentUser();
  assertAdminMaster(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: true },
  });
  if (!tenant?.id) throw new Error("Câmara não encontrada.");

  const infra = ((tenant.settings as any)?.infra || {}) as Record<string, any>;
  const host = String(infra.subdomain_host || "").trim();
  if (!host) throw new Error("Subdomínio não configurado para esta Câmara.");

  const appPort = Number(infra.app_target_port || 3000);

  const script = `set -euo pipefail
apt-get update -y >/dev/null
apt-get install -y nginx >/dev/null
cat >/etc/nginx/sites-available/${host}.conf <<'NGINXCONF'
server {
  listen 80;
  listen [::]:80;
  server_name ${host};
  client_max_body_size 50m;
  location / {
    proxy_pass http://127.0.0.1:${appPort};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
  }
}
NGINXCONF
ln -sf /etc/nginx/sites-available/${host}.conf /etc/nginx/sites-enabled/${host}.conf
nginx -t
systemctl reload nginx
echo '[OK] Vhost ${host} provisionado em Nginx'
`;

  const log = await runSsh(script);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...(tenant.settings as any),
        infra: {
          ...infra,
          provisioned_at: new Date().toISOString(),
          provision_status: "NGINX_OK",
          provision_log_last: log.slice(-8000),
        },
      } as any,
      updated_at: new Date(),
    },
  });

  revalidatePath("/plataforma");
  revalidatePath("/admin-master/camaras");
  return { success: true, log };
}

export async function ativarSslCamaraNaVps(tenantId: string) {
  const user = await getCurrentUser();
  assertAdminMaster(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: true },
  });
  if (!tenant?.id) throw new Error("Câmara não encontrada.");

  const infra = ((tenant.settings as any)?.infra || {}) as Record<string, any>;
  const host = String(infra.subdomain_host || "").trim();
  if (!host) throw new Error("Subdomínio não configurado para esta Câmara.");

  const certEmail = process.env.CERTBOT_EMAIL || "infra@syslegis.com";

  const script = `set -euo pipefail
apt-get update -y >/dev/null
apt-get install -y certbot python3-certbot-nginx >/dev/null
certbot --nginx -d ${host} --non-interactive --agree-tos -m ${certEmail} --redirect
echo '[OK] SSL ativado para ${host}'
`;

  const log = await runSsh(script);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...(tenant.settings as any),
        infra: {
          ...infra,
          ssl_enabled_at: new Date().toISOString(),
          provision_status: "SSL_OK",
          provision_log_last: log.slice(-8000),
        },
      } as any,
      updated_at: new Date(),
    },
  });

  revalidatePath("/plataforma");
  revalidatePath("/admin-master/camaras");
  return { success: true, log };
}

export async function validarDnsCamara(tenantId: string) {
  const user = await getCurrentUser();
  assertAdminMaster(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, settings: true },
  });
  if (!tenant?.id) throw new Error("Câmara não encontrada.");

  const infra = ((tenant.settings as any)?.infra || {}) as Record<string, any>;
  const host = String(infra.subdomain_host || "").trim();
  if (!host) throw new Error("Subdomínio não configurado para esta Câmara.");

  let resolvedIps: string[] = [];
  try {
    resolvedIps = await resolve4(host);
  } catch (e: any) {
    const message = String(e?.message || "Falha ao resolver DNS.");
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        settings: {
          ...(tenant.settings as any),
          infra: {
            ...infra,
            dns_validated_at: new Date().toISOString(),
            dns_status: "ERROR",
            dns_message: message,
          },
        } as any,
        updated_at: new Date(),
      },
    });
    revalidatePath("/plataforma");
    revalidatePath("/admin-master/camaras");
    return { success: false, host, resolvedIps: [], expectedIp: null, matched: false, message };
  }

  const expectedIp = String(process.env.PROVISION_PUBLIC_IP || "").trim() || null;
  const matched = expectedIp ? resolvedIps.includes(expectedIp) : resolvedIps.length > 0;
  const message = expectedIp
    ? matched
      ? `DNS OK: ${host} resolve para ${expectedIp}.`
      : `DNS divergente: ${host} resolve para [${resolvedIps.join(", ")}], esperado ${expectedIp}.`
    : `DNS resolvido para [${resolvedIps.join(", ")}].`;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...(tenant.settings as any),
        infra: {
          ...infra,
          dns_validated_at: new Date().toISOString(),
          dns_status: matched ? "OK" : "MISMATCH",
          dns_message: message,
          dns_resolved_ips: resolvedIps,
        },
      } as any,
      updated_at: new Date(),
    },
  });

  revalidatePath("/plataforma");
  revalidatePath("/admin-master/camaras");
  return { success: matched, host, resolvedIps, expectedIp, matched, message };
}

/** Preenche `settings.infra.subdomain_host` a partir do slug (ex.: câmaras migradas sem infra). */
export async function garantirSubdominioCadastrado(tenantId: string) {
  const user = await getCurrentUser();
  assertAdminMaster(user);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: true },
  });
  if (!tenant?.id) throw new Error("Câmara não encontrada.");

  const baseDomain = process.env.APP_BASE_DOMAIN || "syslegis.com";
  const apex = baseDomain.replace(/^www\./i, "");
  const subdomainHost = `${tenant.slug}.${apex}`;
  const prev = (tenant.settings as Record<string, unknown>) || {};
  const prevInfra = (prev.infra as Record<string, unknown>) || {};

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...prev,
        infra: {
          ...prevInfra,
          subdomain_host: subdomainHost,
          app_target_port: Number(
            prevInfra.app_target_port || process.env.APP_PORT || 3000
          ),
        },
      } as any,
      updated_at: new Date(),
    },
  });

  revalidatePath("/plataforma");
  revalidatePath("/admin-master/camaras");
  return { success: true as const, subdomainHost };
}
