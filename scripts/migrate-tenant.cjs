/**
 * Copia um tenant completo do Postgres de origem para o de destino (mesmo schema).
 *
 * Uso:
 *   SOURCE_DATABASE_URL="postgresql://..." TARGET_DATABASE_URL="postgresql://..." \
 *     node scripts/migrate-tenant.cjs camara-teste
 *
 * Variáveis alternativas: DATABASE_URL_SOURCE, DATABASE_URL_TARGET
 *
 * Ordem de INSERT respeita FKs; users com vereador_id são inseridos em duas fases.
 */

const { Client } = require("pg");

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: node scripts/migrate-tenant.cjs <slug-do-tenant>");
  process.exit(1);
}

const sourceUrl =
  process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL_SOURCE;
const targetUrl =
  process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL_TARGET;

if (!sourceUrl || !targetUrl) {
  console.error(
    "Defina SOURCE_DATABASE_URL e TARGET_DATABASE_URL (ou DATABASE_URL_*)."
  );
  process.exit(1);
}

function sqlLiteral(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (val instanceof Date) {
    return `'${val.toISOString().replace("T", " ").replace("Z", "+00:00")}'`;
  }
  if (Buffer.isBuffer(val)) return `'\\x${val.toString("hex")}'`;
  if (typeof val === "object" && val !== null) {
    return `'${JSON.stringify(val).replace(/\\/g, "\\\\").replace(/'/g, "''")}'::jsonb`;
  }
  const s = String(val);
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function rowInsert(table, columns, row) {
  const vals = columns.map((c) => sqlLiteral(row[c]));
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${vals.join(", ")});`;
}

async function queryAll(client, text, params = []) {
  const r = await client.query(text, params);
  return r.rows;
}

async function main() {
  const src = new Client({ connectionString: sourceUrl });
  const dst = new Client({ connectionString: targetUrl });
  await src.connect();
  await dst.connect();

  const tenants = await queryAll(
    src,
    `SELECT * FROM tenants WHERE slug = $1 AND deleted_at IS NULL`,
    [slug]
  );
  if (tenants.length === 0) {
    console.error(`Tenant com slug "${slug}" não encontrado na origem.`);
    await src.end();
    await dst.end();
    process.exit(1);
  }
  const tenant = tenants[0];
  const tid = tenant.id;
  console.log(`Tenant: ${tenant.nome_camara} (${tid})`);

  const existing = await queryAll(
    dst,
    `SELECT id FROM tenants WHERE slug = $1`,
    [slug]
  );
  if (existing.length > 0) {
    console.error(
      `Já existe tenant com slug "${slug}" no destino. Remova ou renomeie antes de importar.`
    );
    await src.end();
    await dst.end();
    process.exit(1);
  }

  const proposicao_tipos = await queryAll(
    src,
    `SELECT * FROM proposicao_tipos WHERE tenant_id = $1`,
    [tid]
  );
  const cargos = await queryAll(src, `SELECT * FROM cargos WHERE tenant_id = $1`, [
    tid,
  ]);
  const setores = await queryAll(src, `SELECT * FROM setores WHERE tenant_id = $1`, [
    tid,
  ]);
  const users = await queryAll(src, `SELECT * FROM users WHERE tenant_id = $1`, [tid]);
  const bancadas = await queryAll(src, `SELECT * FROM bancadas WHERE tenant_id = $1`, [
    tid,
  ]);
  const vereadores = await queryAll(
    src,
    `SELECT * FROM vereadores WHERE tenant_id = $1`,
    [tid]
  );
  const comissoes = await queryAll(
    src,
    `SELECT * FROM comissoes WHERE tenant_id = $1`,
    [tid]
  );
  const comissao_membros = await queryAll(
    src,
    `SELECT cm.* FROM comissao_membros cm
     INNER JOIN comissoes c ON c.id = cm.comissao_id
     WHERE c.tenant_id = $1`,
    [tid]
  );
  const visitantes = await queryAll(
    src,
    `SELECT * FROM visitantes WHERE tenant_id = $1`,
    [tid]
  );
  const modelos_projetos = await queryAll(
    src,
    `SELECT * FROM modelos_projetos WHERE tenant_id = $1`,
    [tid]
  );
  const proposicoes = await queryAll(
    src,
    `SELECT * FROM proposicoes WHERE tenant_id = $1`,
    [tid]
  );
  const tramitacoes = await queryAll(
    src,
    `SELECT * FROM tramitacoes WHERE tenant_id = $1`,
    [tid]
  );
  const pareceres = await queryAll(
    src,
    `SELECT * FROM pareceres WHERE tenant_id = $1`,
    [tid]
  );
  const sessoes = await queryAll(src, `SELECT * FROM sessoes WHERE tenant_id = $1`, [
    tid,
  ]);
  const ordem_do_dia = await queryAll(
    src,
    `SELECT * FROM ordem_do_dia WHERE tenant_id = $1`,
    [tid]
  );
  const presencas = await queryAll(
    src,
    `SELECT * FROM presencas WHERE tenant_id = $1`,
    [tid]
  );
  const votacoes = await queryAll(
    src,
    `SELECT * FROM votacoes WHERE tenant_id = $1`,
    [tid]
  );
  const votos = await queryAll(src, `SELECT * FROM votos WHERE tenant_id = $1`, [tid]);
  const solicitacoes_palavra = await queryAll(
    src,
    `SELECT * FROM solicitacoes_palavra WHERE tenant_id = $1`,
    [tid]
  );

  const tenantCols = Object.keys(tenant);
  /** Emails já usados no destino (global) — remapear duplicatas para não violar users_email_key */
  async function emailDisponivel(email) {
    const r = await dst.query(`SELECT 1 FROM users WHERE email = $1 LIMIT 1`, [
      email,
    ]);
    return r.rowCount === 0;
  }

  function emailComSufixoMigracao(email, sufixoSlug) {
    const at = email.indexOf("@");
    if (at < 1) return `${email}+migrado-${sufixoSlug}`;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    return `${local}+migrado-${sufixoSlug}@${domain}`;
  }

  const userVereadorBackfill = new Map();
  const usersPhase1 = [];
  for (const u of users) {
    let row = { ...u };
    if (row.vereador_id) {
      userVereadorBackfill.set(row.id, row.vereador_id);
      row = { ...row, vereador_id: null };
    }
    if (!(await emailDisponivel(row.email))) {
      let novo = emailComSufixoMigracao(row.email, slug);
      let n = 0;
      while (!(await emailDisponivel(novo))) {
        n += 1;
        novo = emailComSufixoMigracao(row.email, `${slug}-${n}`);
      }
      console.warn(`Email duplicado no destino: ${row.email} -> ${novo}`);
      row = { ...row, email: novo };
    }
    usersPhase1.push(row);
  }

  try {
    await dst.query("BEGIN");

    await dst.query(rowInsert("tenants", tenantCols, tenant));

    for (const row of proposicao_tipos) {
      await dst.query(rowInsert("proposicao_tipos", Object.keys(row), row));
    }
    for (const row of cargos) {
      await dst.query(rowInsert("cargos", Object.keys(row), row));
    }
    for (const row of setores) {
      await dst.query(rowInsert("setores", Object.keys(row), row));
    }
    for (const row of usersPhase1) {
      await dst.query(rowInsert("users", Object.keys(row), row));
    }
    for (const row of bancadas) {
      await dst.query(rowInsert("bancadas", Object.keys(row), row));
    }
    for (const row of vereadores) {
      await dst.query(rowInsert("vereadores", Object.keys(row), row));
    }
    for (const [uid, vid] of userVereadorBackfill) {
      await dst.query(`UPDATE users SET vereador_id = $1 WHERE id = $2`, [
        vid,
        uid,
      ]);
    }
    for (const row of comissoes) {
      await dst.query(rowInsert("comissoes", Object.keys(row), row));
    }
    for (const row of comissao_membros) {
      await dst.query(rowInsert("comissao_membros", Object.keys(row), row));
    }
    for (const row of visitantes) {
      await dst.query(rowInsert("visitantes", Object.keys(row), row));
    }
    for (const row of modelos_projetos) {
      await dst.query(rowInsert("modelos_projetos", Object.keys(row), row));
    }
    for (const row of proposicoes) {
      await dst.query(rowInsert("proposicoes", Object.keys(row), row));
    }
    for (const row of tramitacoes) {
      await dst.query(rowInsert("tramitacoes", Object.keys(row), row));
    }
    for (const row of pareceres) {
      await dst.query(rowInsert("pareceres", Object.keys(row), row));
    }
    for (const row of sessoes) {
      await dst.query(rowInsert("sessoes", Object.keys(row), row));
    }
    for (const row of ordem_do_dia) {
      await dst.query(rowInsert("ordem_do_dia", Object.keys(row), row));
    }
    for (const row of presencas) {
      await dst.query(rowInsert("presencas", Object.keys(row), row));
    }
    for (const row of votacoes) {
      await dst.query(rowInsert("votacoes", Object.keys(row), row));
    }
    for (const row of votos) {
      await dst.query(rowInsert("votos", Object.keys(row), row));
    }
    for (const row of solicitacoes_palavra) {
      await dst.query(rowInsert("solicitacoes_palavra", Object.keys(row), row));
    }

    await dst.query("COMMIT");
    console.log(
      `OK: importados proposicao_tipos=${proposicao_tipos.length}, users=${users.length}, vereadores=${vereadores.length}, proposicoes=${proposicoes.length}, sessoes=${sessoes.length}.`
    );
  } catch (e) {
    await dst.query("ROLLBACK");
    console.error(e);
    process.exitCode = 1;
  } finally {
    await src.end();
    await dst.end();
  }
}

main();
