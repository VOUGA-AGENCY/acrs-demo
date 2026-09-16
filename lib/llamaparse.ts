import type { OCRResult } from "@/types";

export class LlamaParseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "LlamaParseError";
  }
}

/**
 * Envia um ficheiro (PDF, JPG, PNG) para a API do LlamaParse e devolve os dados estruturados da fatura.
 */
export async function parseInvoiceWithLlamaParse(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<OCRResult> {
  const apiKey = process.env.LLAMAPARSE_API_KEY;

  if (!apiKey || apiKey.startsWith("llx-your-api-key")) {
    throw new LlamaParseError(
      "A chave de API do LlamaParse (LLAMAPARSE_API_KEY) não está configurada no ficheiro .env.local. Obtenha uma chave em https://cloud.llamaindex.ai/ para ativar o OCR.",
      "MISSING_API_KEY",
    );
  }

  // 1. Preparar multipart/form-data
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("file", blob, fileName);

  const configuration = {
    tier: "agentic",
    version: "latest",
    agentic_options: {
      custom_prompt:
        "Extract all invoice and receipt details in Portuguese or English: vendor/supplier name (fornecedor), tax identification number (NIF), document/invoice number (número da fatura), document date (data YYYY-MM-DD), total gross amount with VAT (valor total com IVA), net amount before VAT (valor sem IVA), VAT amount (montante IVA), VAT percentage rate (taxa IVA), and individual line items with description, quantity, unit price, and subtotal formatted in a markdown table.",
    },
  };
  formData.append("configuration", JSON.stringify(configuration));

  // 2. Submeter para a API do LlamaParse (v2 parse upload)
  let uploadRes: Response;
  try {
    uploadRes = await fetch("https://api.cloud.llamaindex.ai/api/v2/parse/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: formData,
    });
  } catch (err: any) {
    throw new LlamaParseError(`Falha de ligação à API do LlamaParse: ${err?.message || err}`);
  }

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new LlamaParseError(
      `Erro no envio para o LlamaParse (${uploadRes.status}): ${errorText}`,
      "UPLOAD_FAILED",
    );
  }

  const uploadData = (await uploadRes.json()) as { id: string; status?: string };
  const jobId = uploadData.id;

  if (!jobId) {
    throw new LlamaParseError("A API do LlamaParse não devolveu um identificador de processamento (job ID).");
  }

  // 3. Polling de status até estar COMPLETED (timeout de 45 segundos)
  const maxAttempts = 30;
  let attempts = 0;
  let markdownResult = "";

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    attempts++;

    const statusRes = await fetch(
      `https://api.cloud.llamaindex.ai/api/v2/parse/${jobId}?expand=markdown`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!statusRes.ok) {
      continue;
    }

    const jobData = (await statusRes.json()) as any;
    const status = jobData.job?.status || jobData.status;

    if (status === "COMPLETED" || status === "SUCCESS") {
      markdownResult = extractMarkdownString(jobData.markdown || jobData.text || jobData.job?.markdown);
      break;
    }

    if (status === "FAILED" || status === "ERROR") {
      const errMsg = jobData.job?.error_message || jobData.job?.error || "Erro desconhecido";
      throw new LlamaParseError(
        `O processamento OCR no LlamaParse falhou: ${errMsg}`,
        "OCR_FAILED",
      );
    }
  }

  if (!markdownResult) {
    throw new LlamaParseError("O LlamaParse demorou demasiado tempo a responder (timeout) ou não devolveu texto legível.");
  }

  // 4. Extrair campos da resposta markdown
  return extractInvoiceFieldsFromMarkdown(markdownResult);
}

/**
 * Converte com segurança qualquer formato de resposta (string, { pages: [...] }, array) em texto Markdown
 */
export function extractMarkdownString(raw: any): string {
  if (typeof raw === "string") return raw;
  if (!raw) return "";
  if (Array.isArray(raw)) {
    return raw
      .map((item) => extractMarkdownString(item))
      .filter(Boolean)
      .join("\n\n");
  }
  if (Array.isArray(raw.pages)) {
    return raw.pages
      .map((p: any) => (typeof p === "string" ? p : p?.markdown || p?.text || ""))
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof raw.markdown === "string") return raw.markdown;
  if (typeof raw.text === "string") return raw.text;
  if (typeof raw.content === "string") return raw.content;
  return JSON.stringify(raw);
}

/**
 * Parser inteligente de campos fiscais e tabela de linhas a partir do Markdown devolvido pelo LlamaParse
 */
export function extractInvoiceFieldsFromMarkdown(markdownInput: any): OCRResult {
  const markdown = extractMarkdownString(markdownInput);
  const result: OCRResult = {
    rawText: markdown,
    confidence: 85,
    linhas: [],
  };

  const lines = markdown.split("\n");

  // 1. Extrair NIF português (9 dígitos, opcionalmente com prefixo PT)
  const nifMatch = markdown.match(/\b(?:NIF|NIPC|VAT|Contribuinte)[\s.:#]*([PTpt]?\s*\d{9})\b/i) ||
    markdown.match(/\b(5\d{8}|9\d{8}|1\d{8}|2\d{8})\b/);
  if (nifMatch) {
    result.nifFornecedor = nifMatch[1].replace(/\s+/g, "").toUpperCase();
  }

  // 2. Extrair Número de Documento / Fatura
  const docNumMatch =
    markdown.match(/\b(?:Fatura|Factura|Doc(?:umento)?|Invoice|Venda a Dinheiro|Recibo|FT|FS|FR|NC)[\s.:#Nºº/]*([A-Z0-9\-_/]+\s*[0-9]+[A-Z0-9\-_/]*)\b/i) ||
    markdown.match(/\b([A-Z]{2,4}\s*(?:202[0-9])?\/[0-9]+)\b/);
  if (docNumMatch) {
    result.numero = docNumMatch[1].trim();
  }

  // 3. Extrair Data
  // Formato YYYY-MM-DD
  const isoDateMatch = markdown.match(/\b(202[0-9]-[01][0-9]-[0-3][0-9])\b/);
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  const ptDateMatch = markdown.match(/\b([0-3][0-9])[/-]([01][0-9])[/-](202[0-9])\b/);

  if (isoDateMatch) {
    result.data = isoDateMatch[1];
  } else if (ptDateMatch) {
    result.data = `${ptDateMatch[3]}-${ptDateMatch[2]}-${ptDateMatch[1]}`;
  }

  // 4. Extrair Valor Total
  const totalMatches = Array.from(
    markdown.matchAll(/(?:Total(?:\s+a\s+Pagar|\s+Documento|\s+Geral|\s+com\s+IVA)?|Valor\s+Total)[\s.:€]*([0-9]{1,3}(?:[.,\s][0-9]{3})*[.,][0-9]{2})\s*(?:€|EUR)?/gi),
  );

  if (totalMatches.length > 0) {
    const lastTotal = totalMatches[totalMatches.length - 1][1];
    result.valorTotal = parsePortugueseCurrency(lastTotal);
  } else {
    // Procura genérica de valores monetários
    const genericAmountMatches = Array.from(markdown.matchAll(/([0-9]{1,3}(?:[.,\s][0-9]{3})*[.,][0-9]{2})\s*(?:€|EUR)/gi));
    if (genericAmountMatches.length > 0) {
      const amounts = genericAmountMatches
        .map((m) => parsePortugueseCurrency(m[1]))
        .filter((n) => !isNaN(n) && n > 0);
      if (amounts.length > 0) {
        result.valorTotal = Math.max(...amounts);
      }
    }
  }

  // 5. Extrair Taxa e Montante de IVA
  const ivaMatch = markdown.match(/\b(?:IVA|Taxa)[\s.:]*([0-9]{1,2})\s*%/i);
  if (ivaMatch) {
    result.ivaTaxa = Number(ivaMatch[1]);
  } else {
    result.ivaTaxa = 23;
  }

  // 6. Extrair Nome do Fornecedor (primeiras linhas ou etiquetas como Empresa / De / Remetente)
  const vendorMatch =
    markdown.match(/(?:Fornecedor|Emitente|Empresa|Razão Social)[\s.:]*([^\n]+)/i) ||
    markdown.match(/^#+\s*([^\n]+)/m);
  if (vendorMatch) {
    const cleaned = vendorMatch[1].replace(/[*_#]/g, "").trim();
    if (cleaned.length > 2 && cleaned.length < 80) {
      result.fornecedor = cleaned;
    }
  }

  // 7. Extrair Linhas de Itens a partir de Tabelas Markdown
  const tableRows = extractTableRows(lines);
  if (tableRows.length > 0) {
    result.linhas = tableRows;
  }

  // Calcular score de confiança baseado no preenchimento dos campos essenciais
  let score = 0;
  if (result.fornecedor) score += 25;
  if (result.valorTotal && result.valorTotal > 0) score += 30;
  if (result.data) score += 20;
  if (result.numero) score += 15;
  if (result.linhas && result.linhas.length > 0) score += 10;

  result.confidence = Math.min(100, Math.max(50, score));

  return result;
}

function parsePortugueseCurrency(str: string): number {
  const cleaned = str
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Number(num.toFixed(2));
}

function extractTableRows(
  lines: string[],
): Array<{ descricao: string; quantidade: number; precoUnitario: number; subtotal: number }> {
  const rows: Array<{ descricao: string; quantidade: number; precoUnitario: number; subtotal: number }> = [];

  let inTable = false;
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      if (cells.some((c) => /descri|artigo|designa|item|produto/i.test(c))) {
        inTable = true;
        headerIndex = i;
        continue;
      }

      if (inTable && i > headerIndex + 1 && cells.length >= 3) {
        // Ignorar separadores como |---|---|
        if (cells[0].includes("---")) continue;

        const desc = cells[0];
        const numCells = cells.slice(1).map(parsePortugueseCurrency).filter((n) => !isNaN(n) && n > 0);

        if (desc.length > 1 && numCells.length >= 2) {
          const qtd = numCells[0] || 1;
          const precoUnit = numCells.length >= 3 ? numCells[1] : (numCells[0] ? numCells[numCells.length - 1] / numCells[0] : numCells[0]);
          const subtotal = numCells[numCells.length - 1];

          rows.push({
            descricao: desc,
            quantidade: qtd,
            precoUnitario: Number(precoUnit.toFixed(2)),
            subtotal: Number(subtotal.toFixed(2)),
          });
        }
      }
    } else {
      if (inTable && rows.length > 0) {
        break;
      }
    }
  }

  return rows;
}
