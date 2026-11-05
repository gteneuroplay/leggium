/** Extrai HTML do DOCX no browser (mammoth). */
export async function extrairHtmlDeDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml({ arrayBuffer });
  const html = value.trim();
  if (!html) {
    throw new Error("Não foi possível extrair texto do DOCX. Verifique o ficheiro.");
  }
  return html;
}
