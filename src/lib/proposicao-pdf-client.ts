/** Extrai texto legível do PDF no browser (pdf.js). */
const TEXTO_PDF_MAX_CHARS = 50_000;

export async function extrairTextoDePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;

  const partes: string[] = [];
  for (let pagina = 1; pagina <= pdf.numPages; pagina += 1) {
    const page = await pdf.getPage(pagina);
    const content = await page.getTextContent();
    const linha = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (linha) partes.push(linha);
  }

  const texto = partes.join("\n\n").trim();
  if (!texto) {
    throw new Error(
      "Não foi possível extrair texto do PDF. O ficheiro pode ser só imagem (digitalizado sem camada de texto).",
    );
  }

  return texto.length > TEXTO_PDF_MAX_CHARS
    ? `${texto.slice(0, TEXTO_PDF_MAX_CHARS)}\n\n[… texto truncado …]`
    : texto;
}
