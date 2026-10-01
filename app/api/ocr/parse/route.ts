import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { parseInvoiceWithLlamaParse, LlamaParseError } from "@/lib/llamaparse";

export const dynamic = "force-dynamic";

// Sistema simples de rate-limiting em memória (por utilizador)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 12; // Máximo 12 chamadas OCR por minuto por utilizador

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

// Validador de número mágico do ficheiro (inspeção real de bytes no cabeçalho)
function validateMagicBytes(buffer: Buffer): "pdf" | "jpg" | "png" | "webp" | null {
  if (buffer.length < 12) return null;

  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "pdf";
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    // 1. AUTENTICAÇÃO OBRIGATÓRIA
    const serverClient = await getSupabaseServerClient();
    if (!serverClient) {
      return NextResponse.json({ error: "Sessão não autenticada." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await serverClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    // 2. RATE LIMITING
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Limite de pedidos OCR excedido. Aguarde um minuto antes de tentar novamente." },
        { status: 429 },
      );
    }

    // 3. VALIDAÇÃO DO PAYLOAD E FICHEIRO
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum ficheiro fornecido para processamento OCR." },
        { status: 400 },
      );
    }

    // Limite de tamanho: 10 MB
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: "O ficheiro excede o tamanho máximo permitido de 10 MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. INSPEÇÃO REAL DO CABEÇALHO DO FICHEIRO (MAGIC BYTES)
    const detectedType = validateMagicBytes(buffer);
    if (!detectedType) {
      return NextResponse.json(
        { error: "Ficheiro inválido. O conteúdo do ficheiro não corresponde a um PDF ou imagem suportada." },
        { status: 415 },
      );
    }

    // 5. GUARDAR NO STORAGE PRIVADO E GERAR URL ASSINADO (SIGNED URL)
    let signedDocumentUrl: string | undefined = undefined;
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `faturas/${user.id}/${Date.now()}_${sanitizedName}`;

      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: file.type || (detectedType === "pdf" ? "application/pdf" : "image/jpeg"),
          upsert: true,
        });

      if (!uploadError && uploadData?.path) {
        // Gerar URL assinado válido por 2 horas (em vez de URL público)
        const { data: signedData, error: signedError } = await adminClient.storage
          .from("documents")
          .createSignedUrl(uploadData.path, 7200);

        if (!signedError && signedData?.signedUrl) {
          signedDocumentUrl = signedData.signedUrl;
        } else {
          signedDocumentUrl = uploadData.path;
        }
      } else if (uploadError) {
        console.warn("Aviso ao guardar ficheiro no storage:", uploadError.message);
      }
    }

    // 6. PROCESSAR OCR COM O LLAMAPARSE
    try {
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        jpg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      };

      const ocrResult = await parseInvoiceWithLlamaParse(
        buffer,
        file.name,
        mimeMap[detectedType] || "application/pdf",
      );
      ocrResult.documentUrl = signedDocumentUrl;

      return NextResponse.json({
        success: true,
        data: ocrResult,
      });
    } catch (ocrErr: any) {
      console.error("Erro no processamento OCR:", ocrErr);

      if (ocrErr instanceof LlamaParseError) {
        return NextResponse.json(
          {
            error: ocrErr.message,
            code: ocrErr.code,
            documentUrl: signedDocumentUrl,
          },
          { status: ocrErr.code === "MISSING_API_KEY" ? 422 : 502 },
        );
      }

      return NextResponse.json(
        {
          error: "Não foi possível extrair os dados da fatura via OCR. Verifique a qualidade do ficheiro.",
          documentUrl: signedDocumentUrl,
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Erro interno na rota /api/ocr/parse:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar o documento." },
      { status: 500 },
    );
  }
}
