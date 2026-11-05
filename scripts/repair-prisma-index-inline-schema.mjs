#!/usr/bin/env node
/** Repara index.js quando o inlineSchema foi partido em linhas literais. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "node_modules/.prisma/client");
const indexPath = path.join(clientDir, "index.js");
const edgePath = path.join(clientDir, "edge.js");

const index = fs.readFileSync(indexPath, "utf8");
const edge = fs.readFileSync(edgePath, "utf8");

const configStart = index.indexOf("const config = {");
const configStartEdge = edge.indexOf("const config = {");
if (configStart < 0 || configStartEdge < 0) {
  console.error("const config não encontrado");
  process.exit(1);
}

function extractConfigBlock(source, start) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error("config block não fechado");
}

let configBlock = extractConfigBlock(edge, configStartEdge);

// Garante ATA no inlineSchema embutido
configBlock = configBlock.replace(
  /enum ProposicaoTipoEnum \{PORTARIA\}/,
  "enum ProposicaoTipoEnum {PROJETO_DE_LEI PROJETO_DE_RESOLUCAO DECRETO_LEGISLATIVO MOCAO REQUERIMENTO INDICACAO EMENDA PORTARIA ATA}",
);
configBlock = configBlock.replace(
  /PORTARIA\n\}/,
  "PORTARIA\n  ATA\n}",
);
configBlock = configBlock.replace(
  /enum ProposicaoTipoEnum \{\\n([^}]+)PORTARIA\\n\}/,
  (m, mid) => `enum ProposicaoTipoEnum {\\n${mid}PORTARIA\\n  ATA\\n}`,
);

const before = index.slice(0, configStart);
const afterMatch = index.match(/\nconst \{ PrismaClient/);
if (!afterMatch) {
  console.error("PrismaClient bootstrap não encontrado após config");
  process.exit(1);
}
const afterStart = index.indexOf(afterMatch[0], configStart);

const repaired = before + configBlock + index.slice(afterStart);
fs.writeFileSync(indexPath, repaired);
console.log("index.js reparado (inlineSchema restaurado a partir de edge.js + ATA)");
