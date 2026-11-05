import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import {
  PROPOSICAO_ARQUIVO_MAX_BYTES,
  TEXTO_PROPOSICAO_DOCUMENTO_IMPORTADO,
  textoEhDocumentoImportado,
} from "@/lib/proposicao-arquivo";
import { isProposicaoPautaManual } from "@/lib/pauta/pauta-manual";

export const maxDuration = 120;

function toDataUrlFromPdfBytes(buf: ArrayBuffer): string {
  const b64 = Buffer.from(buf).toString("base64");
  return `data:application/pdf;base64,${b64}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.profile?.tenant_id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    let proposicaoId: string;
    let pdfDataUrl: string;
    let documentoImportado = false;
    let anexoPautaManual = false;

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const id = form.get("proposicaoId");
      const file = form.get("pdf") ?? form.get("documento");
      documentoImportado = form.get("documentoImportado") === "1";
      anexoPautaManual = form.get("anexoPautaManual") === "1";
      if (typeof id !== "string" || !id.trim()) {
        return NextResponse.json({ error: "ID da proposição não informado" }, { status: 400 });
      }
      if (!(file instanceof Blob) || file.size === 0) {
        return NextResponse.json({ error: "Ficheiro PDF em falta ou vazio" }, { status: 400 });
      }
      if (file.size > PROPOSICAO_ARQUIVO_MAX_BYTES) {
        return NextResponse.json({ error: "Ficheiro demasiado grande (máx. 15 MB)." }, { status: 413 });
      }
      proposicaoId = id.trim();

      const prop = await prisma.proposicao.findFirst({
        where: {
          id: proposicaoId,
          tenant_id: user.profile.tenant_id,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!prop) {
        return NextResponse.json({ error: "Proposição não encontrada" }, { status: 404 });
      }

      const ab = await file.arrayBuffer();
      pdfDataUrl = toDataUrlFromPdfBytes(ab);
    } else {
      const body = (await req.json()) as {
        proposicaoId?: unknown;
        pdfBase64?: unknown;
        documentoImportado?: unknown;
      };
      const id = typeof body.proposicaoId === "string" ? body.proposicaoId.trim() : "";
      const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64.trim() : "";
      documentoImportado = body.documentoImportado === true || body.documentoImportado === "1";
      anexoPautaManual =
        (body as { anexoPautaManual?: unknown }).anexoPautaManual === true ||
        (body as { anexoPautaManual?: unknown }).anexoPautaManual === "1";
      if (!id) {
        return NextResponse.json({ error: "ID da proposição não informado" }, { status: 400 });
      }
      if (!pdfBase64) {
        return NextResponse.json({ error: "Conteúdo do PDF não informado" }, { status: 400 });
      }
      proposicaoId = id;
      pdfDataUrl = pdfBase64.includes("data:") ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`;

      const propJson = await prisma.proposicao.findFirst({
        where: {
          id: proposicaoId,
          tenant_id: user.profile.tenant_id,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!propJson) {
        return NextResponse.json({ error: "Proposição não encontrada" }, { status: 404 });
      }
    }

    const existente = await prisma.proposicao.findFirst({
      where: { id: proposicaoId, tenant_id: user.profile.tenant_id },
      select: { texto_completo: true },
    });

    const gravarMarcadorImportado =
      documentoImportado &&
      !anexoPautaManual &&
      !isProposicaoPautaManual(existente?.texto_completo) &&
      !textoEhDocumentoImportado(existente?.texto_completo);

    await prisma.proposicao.update({
      where: { id: proposicaoId, tenant_id: user.profile.tenant_id },
      data: {
        pdf_url: pdfDataUrl,
        ...(gravarMarcadorImportado
          ? { texto_completo: TEXTO_PROPOSICAO_DOCUMENTO_IMPORTADO }
          : {}),
      },
    });

    revalidatePath("/proposicoes");
    revalidatePath("/tramitacao");
    revalidatePath("/pautas");
    revalidatePath("/painel");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro na API de upload:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
