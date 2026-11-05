"use server";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

type AttemptResult = {
  model: string;
  reason: string;
  status: number | null;
};

function parseStatusCode(errorMessage: string) {
  const match = errorMessage.match(/\[(\d{3})\s/);
  return match ? Number(match[1]) : null;
}

function isQuotaError(errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  return lower.includes("quota exceeded") || parseStatusCode(errorMessage) === 429;
}

function isRetryableOverload(errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  const status = parseStatusCode(errorMessage);
  return status === 503 || lower.includes("high demand") || lower.includes("service unavailable");
}

function normalizeModelError(errorMessage: string) {
  if (isQuotaError(errorMessage)) return "quota_exceeded";
  if (isRetryableOverload(errorMessage)) return "service_overloaded";
  return "model_failed";
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text: string) {
  const cleaned = text.replace(/```json\n?/, "").replace(/```\n?$/, "").trim();
  return JSON.parse(cleaned);
}

export async function gerarEsboçoProposicao(tipoNome: string, promptUsuario: string, contexto?: { autor?: string, coautores?: string[], data?: string }) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.profile.tenant_id },
    select: { gemini_api_key: true }
  });

  const apiKey = tenant?.gemini_api_key;
  if (!apiKey) throw new Error("Chave da SysLegisIA não configurada.");
  if (!apiKey.startsWith("AIza")) throw new Error("Chave da SysLegisIA inválida.");

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `Você é um consultor jurídico legislativo municipal brasileiro altamente qualificado.
  Crie um esboço técnico e formal de ${tipoNome} para o seguinte tema: "${promptUsuario}".

  DADOS PARA O DOCUMENTO:
  - Autor Principal: ${contexto?.autor || "Não informado"}
  - Coautores: ${contexto?.coautores?.join(", ") || "Nenhum"}
  - Data de Protocolo: ${contexto?.data || "Data atual"}

  INSTRUÇÕES TÉCNICAS:
  - Use o formato padrão de leis municipais (Epígrafe, Ementa, Artigos e Justificativa).
  - Use termos jurídicos adequados (ex: "Preclaro", "Escopo Precípuo", "Prerrogativa").
  - No final do texto integral, inclua o local e a data por extenso (ex: Sala das Sessões, [DIA] de [MÊS] de [ANO]).
  - Liste os nomes do autor e dos coautores para assinatura no final.
  - Retorne APENAS um JSON puro com os campos "ementa" (curta) e "texto_integral" (texto completo formatado).
  - NÃO inclua explicações ou notas fora do JSON.`;

  const models = [
    "gemini-3.1-pro-preview",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview"
  ];
  const attempts: AttemptResult[] = [];

  for (const modelName of models) {
    const model = genAI.getGenerativeModel({ model: modelName });
    const maxTries = 2;

    for (let tryIndex = 1; tryIndex <= maxTries; tryIndex++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = safeJsonParse(response.text());

        if (attempts.length > 0) {
          console.info(
            `SysLegisIA: geração concluída com fallback (${attempts.length} falha(s) prévia(s), modelo vencedor: ${modelName}).`
          );
        }

        return parsed;
      } catch (err: any) {
        const rawMessage = err?.message || "Erro desconhecido";
        const status = parseStatusCode(rawMessage);
        const reason = normalizeModelError(rawMessage);
        attempts.push({ model: modelName, reason, status });

        if (isRetryableOverload(rawMessage) && tryIndex < maxTries) {
          await wait(1200);
          continue;
        }
        break;
      }
    }
  }

  const allQuota = attempts.length > 0 && attempts.every((a) => a.reason === "quota_exceeded");
  if (allQuota) {
    throw new Error("SysLegisIA temporariamente indisponível: cota da API atingida. Verifique faturamento/limites e tente novamente.");
  }

  throw new Error("SysLegisIA indisponível no momento. Tente novamente em alguns instantes.");
}

export async function refinarTextoLegislativo(texto: string, tipoNome: string) {
  const user = await getCurrentUser();
  if (!user?.profile?.tenant_id) throw new Error("Não autorizado");

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.profile.tenant_id },
    select: { gemini_api_key: true }
  });

  const apiKey = tenant?.gemini_api_key;
  if (!apiKey?.startsWith("AIza")) throw new Error("Chave da SysLegisIA inválida.");

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `Você é um consultor jurídico. Refine o texto abaixo de um(a) ${tipoNome}, tornando-o mais formal, técnico e impactante.
  REGRAS CRÍTICAS:
  - Devolva APENAS o texto refinado final.
  - NÃO inclua introduções, saudações ou listas de alterações.
  - Mantenha a estrutura de artigos e justificativa.
  - Use vocabulário jurídico de alto nível.
  
  TEXTO PARA REFINAR:
  ${texto}`;

  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  for (let tryIndex = 1; tryIndex <= 2; tryIndex++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim() || texto;
    } catch (error: any) {
      const message = error?.message || "Erro desconhecido";
      if (isRetryableOverload(message) && tryIndex < 2) {
        await wait(1200);
        continue;
      }
      if (isQuotaError(message)) {
        throw new Error("SysLegisIA indisponível para refino: cota da API atingida.");
      }
      throw new Error("Erro no refino legislativo. Tente novamente.");
    }
  }

  throw new Error("Erro no refino legislativo. Tente novamente.");
}
