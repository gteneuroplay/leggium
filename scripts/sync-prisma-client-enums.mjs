#!/usr/bin/env node
/**
 * Sincroniza ProposicaoTipoEnum do prisma/schema.prisma no client gerado.
 * Use quando `prisma generate` falhar (ex.: ERR_REQUIRE_ESM com zeptomatch).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "prisma/schema.prisma");
const clientDir = path.join(root, "node_modules/.prisma/client");

const schema = fs.readFileSync(schemaPath, "utf8");
const enumMatch = schema.match(/enum\s+ProposicaoTipoEnum\s*\{([^}]+)\}/s);
if (!enumMatch) {
  console.error("enum ProposicaoTipoEnum não encontrado em prisma/schema.prisma");
  process.exit(1);
}

const values = enumMatch[1]
  .split("\n")
  .map((l) => l.replace(/\/\/.*/, "").trim())
  .filter(Boolean);

if (values.length === 0) {
  console.error("enum ProposicaoTipoEnum vazio");
  process.exit(1);
}

const jsEnumBody = values.map((v) => `  ${v}: '${v}'`).join(",\n");
const tsEnumBody = values.map((v) => `  ${v}: '${v}'`).join(",\n");
const prismaEnumBody = values.map((v) => `  ${v}`).join("\n");

function patchFile(relPath, replacers) {
  const filePath = path.join(clientDir, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`skip (missing): ${relPath}`);
    return false;
  }
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  const inlinePatched = patchInlineSchemaEnum(content);
  if (inlinePatched !== content) {
    content = inlinePatched;
    changed = true;
  }
  for (const [pattern, replacement] of replacers) {
    const next = content.replace(pattern, replacement);
    if (next !== content) {
      content = next;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`patched: ${relPath}`);
  } else {
    console.warn(`no match: ${relPath}`);
  }
  return changed;
}

const jsEnumExport = `exports.ProposicaoTipoEnum = exports.$Enums.ProposicaoTipoEnum = {\n${jsEnumBody}\n};`;
const jsEnumPattern =
  /exports\.ProposicaoTipoEnum = exports\.\$Enums\.ProposicaoTipoEnum = \{[\s\S]*?\};/;

function patchInlineSchemaEnum(content) {
  if (content.includes("PORTARIA\\n  ATA\\n}\\n\\nenum ProposicaoStatus")) {
    return content;
  }
  return content.replace(
    /PORTARIA\\n\}\\n\\nenum ProposicaoStatus/g,
    "PORTARIA\\n  ATA\\n}\\n\\nenum ProposicaoStatus",
  );
}

patchFile("index.js", [[jsEnumPattern, jsEnumExport]]);

patchFile("edge.js", [[jsEnumPattern, jsEnumExport]]);

patchFile("index-browser.js", [
  [
    /ProposicaoTipoEnum:\s*\{[\s\S]*?\}/,
    `ProposicaoTipoEnum: {\n${jsEnumBody}\n}`,
  ],
]);

patchFile("index.d.ts", [
  [
    /export const ProposicaoTipoEnum: \{[\s\S]*?\};/,
    `export const ProposicaoTipoEnum: {\n${tsEnumBody}\n};`,
  ],
]);

patchFile("schema.prisma", [
  [/enum ProposicaoTipoEnum \{[^}]+\}/, `enum ProposicaoTipoEnum {\n${prismaEnumBody}\n}`],
]);

console.log(`ProposicaoTipoEnum: ${values.join(", ")}`);
