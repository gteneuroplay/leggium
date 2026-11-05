export type UploadProposicaoPdfOptions = {
  /** true = PDF de proposição protocolada; grava marcador em texto_completo */
  documentoImportado?: boolean;
  /** true = anexo em matéria manual da pauta; não altera texto_completo (marcador pauta-manual) */
  anexoPautaManual?: boolean;
};

/** Upload do PDF oficial da proposição (multipart para a API existente). */
export async function uploadProposicaoPdf(
  proposicaoId: string,
  file: Blob,
  filename = "proposicao.pdf",
  options?: UploadProposicaoPdfOptions,
): Promise<void> {
  const form = new FormData();
  form.append("proposicaoId", proposicaoId);
  form.append("pdf", file, filename);
  if (options?.documentoImportado) {
    form.append("documentoImportado", "1");
  }
  if (options?.anexoPautaManual) {
    form.append("anexoPautaManual", "1");
  }

  const response = await fetch("/api/proposicoes/upload-pdf", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = `HTTP ${response.status}`;
    if (response.status === 413) {
      message =
        "Ficheiro demasiado grande para o servidor (413). Peça ao administrador para definir «client_max_body_size 50m;» no Nginx e recarregar.";
    } else {
      try {
        const errJson = JSON.parse(raw) as { error?: string };
        if (errJson.error) message = errJson.error;
      } catch {
        if (raw.trimStart().startsWith("<")) {
          message =
            "O servidor devolveu HTML em vez de JSON (muitas vezes limite de tamanho no proxy). Verifique Nginx «client_max_body_size».";
        }
      }
    }
    throw new Error(message);
  }
}
