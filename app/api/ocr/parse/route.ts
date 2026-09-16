import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseInvoiceWithLlamaParse, LlamaParseError } from "@/lib/llamaparse";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum ficheiro fornecido para processamento OCR." },
        { status: 400 },
      );
    }

    // Validar tipo de ficheiro
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/tiff",
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
      return NextResponse.json(
        { error: "Formato não suportado. Por favor envie um ficheiro PDF, JPG ou PNG." },
        { status: 400 },
      );
    }

    // Validar tamanho máximo (10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: "O ficheiro excede o tamanho máximo permitido de 10 MB." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Guardar no Supabase Storage (bucket 'documents')
    let documentUrl: string | undefined = undefined;
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `faturas/${Date.now()}_${sanitizedName}`;

      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });

      if (!uploadError && uploadData?.path) {
        const { data: publicUrlData } = adminClient.storage
          .from("documents")
          .getPublicUrl(uploadData.path);
        documentUrl = publicUrlData?.publicUrl || storagePath;
      } else if (uploadError) {
        console.warn("Aviso: Falha ao guardar documento na base de dados:", uploadError.message);
      }
    }

    // 2. Processar OCR com o LlamaParse
    try {
      const ocrResult = await parseInvoiceWithLlamaParse(buffer, file.name, file.type || "application/pdf");
      ocrResult.documentUrl = documentUrl;

      return NextResponse.json({
        success: true,
        data: ocrResult,
      });
    } catch (ocrErr: any) {
      console.error("Erro no processamento LlamaParse:", ocrErr);

      if (ocrErr instanceof LlamaParseError) {
        return NextResponse.json(
          {
            error: ocrErr.message,
            code: ocrErr.code,
            documentUrl,
          },
          { status: ocrErr.code === "MISSING_API_KEY" ? 422 : 502 },
        );
      }

      return NextResponse.json(
        {
          error: ocrErr?.message || "Erro durante o processamento OCR da fatura.",
          documentUrl,
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Erro na rota /api/ocr/parse:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
