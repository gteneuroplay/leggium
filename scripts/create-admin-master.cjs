/**
 * Cria ou atualiza um utilizador ADMIN_MASTER.
 *
 * Uso: node scripts/create-admin-master.cjs <email> <senha>
 */
const { config } = require("dotenv");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

config({ path: ".env.local" });
config({ path: ".env" });

const emailArg = process.argv[2];
const passwordArg = process.argv[3];

if (!emailArg || !passwordArg) {
  console.error("Uso: node scripts/create-admin-master.cjs <email> <senha>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL em .env.local ou .env");
  process.exit(1);
}

const SALT_ROUNDS = 12;

function nomeFromEmail(e) {
  const local = e.split("@")[0] || "Administrador";
  const spaced = local.replace(/[._-]+/g, " ").trim();
  const titled = spaced.replace(/\b\w/g, (c) => c.toUpperCase());
  return titled || "Administrador Master";
}

async function main() {
  const email = emailArg.trim().toLowerCase();
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const tenant =
      (await prisma.tenant.findFirst({
        where: { slug: "camara-aracaju", deleted_at: null },
        select: { id: true },
      })) ??
      (await prisma.tenant.findFirst({
        where: { deleted_at: null },
        orderBy: { created_at: "asc" },
        select: { id: true },
      }));

    if (!tenant) {
      throw new Error("Nenhum tenant encontrado. Corra /setup ou crie um tenant primeiro.");
    }

    const senhaHash = await bcrypt.hash(passwordArg, SALT_ROUNDS);
    const nome = nomeFromEmail(email);
    const usernameBase = (email.split("@")[0] || "admin").replace(/[^a-zA-Z0-9._-]/g, "");
    const userId = randomUUID();

    const row = await prisma.user.upsert({
      where: { email },
      create: {
        id: userId,
        tenant_id: tenant.id,
        nome,
        email,
        senha_hash: senhaHash,
        role: "ADMIN_MASTER",
        username: usernameBase.slice(0, 50),
        status: true,
      },
      update: {
        tenant_id: tenant.id,
        nome,
        senha_hash: senhaHash,
        role: "ADMIN_MASTER",
        username: usernameBase.slice(0, 50),
        status: true,
        deleted_at: null,
      },
    });

    console.log("OK — ADMIN_MASTER:", row.email, "| tenant:", row.tenant_id);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
