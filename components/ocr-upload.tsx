"use client";
import { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, Camera, Eye } from "lucide-react";
import type { OCRResult } from "@/types";
import { money } from "@/lib/format";

export function OCRUpload({
  onExtracted,
  compact = false,
}: {
  onExtracted: (result: OCRResult) => void;
  compact?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepText, setStepText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<OCRResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileSelect(selectedFile: File) {
    setError(null);
    setExtractedData(null);
    setFile(selectedFile);

    // Iniciar automaticamente o OCR ao selecionar o ficheiro
    processFile(selectedFile);
  }

  async function processFile(fileToProcess: File) {
    setLoading(true);
    setError(null);
    setStepText("A guardar fatura na base de dados...");

    try {
      const formData = new FormData();
      formData.append("file", fileToProcess);

      setStepText("A analisar fatura com LlamaParse OCR...");

      const res = await fetch("/api/ocr/parse", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.code === "MISSING_API_KEY") {
          throw new Error(
            "Chave do LlamaParse não configurada. Adicione 'LLAMAPARSE_API_KEY' ao ficheiro .env.local para ativar a extração automática.",
          );
        }
        throw new Error(json.error || "Falha na extração de dados do documento.");
      }

      setStepText("Dados extraídos com sucesso!");
      const data: OCRResult = json.data;
      setExtractedData(data);
      onExtracted(data);
    } catch (err: any) {
      console.error("Erro OCR:", err);
      setError(err?.message || "Ocorreu um erro ao processar a fatura.");
    } finally {
      setLoading(false);
      setStepText("");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  return (
    <div className={`ocr-upload-box ${compact ? "ocr-compact" : ""}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFileSelect(f);
        }}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFileSelect(f);
        }}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
      />

      {!file && !loading && (
        <div
          className={`ocr-dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="ocr-dropzone-icon">
            <Sparkles size={24} color="#d85b2b" />
          </div>
          <div className="ocr-dropzone-text">
            <strong>Carregar Fatura com OCR Inteligente</strong>
            <span>Arraste ou clique para enviar PDF, JPG ou PNG</span>
          </div>
          <div className="ocr-dropzone-actions">
            <button
              type="button"
              className="button-ghost"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              title="Fotografar fatura"
            >
              <Camera size={16} />
              <span>Fotografar</span>
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="ocr-loading-card">
          <Loader2 size={28} className="spinner" />
          <div>
            <strong>Processamento Inteligente LlamaParse</strong>
            <p>{stepText}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="ocr-error-card">
          <AlertCircle size={20} color="#ae4949" />
          <div style={{ flex: 1 }}>
            <strong>Não foi possível concluir o OCR</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            className="button-ghost"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: "11px" }}
          >
            Tentar outro
          </button>
        </div>
      )}

      {extractedData && (
        <div className="ocr-success-card">
          <div className="ocr-success-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={18} color="#2b7754" />
              <strong>Dados extraídos da fatura</strong>
            </div>
            {extractedData.confidence != null && (
              <span
                className="badge"
                style={{
                  background: extractedData.confidence >= 80 ? "#eef8f2" : "#fdf6ed",
                  color: extractedData.confidence >= 80 ? "#2b7754" : "#996b00",
                  borderColor: extractedData.confidence >= 80 ? "#c3e6d1" : "#f3dfb4",
                }}
              >
                {extractedData.confidence}% de confiança
              </span>
            )}
          </div>

          <div className="ocr-fields-preview">
            <div>
              <small>Fornecedor</small>
              <b>{extractedData.fornecedor || "—"}</b>
            </div>
            {extractedData.nifFornecedor && (
              <div>
                <small>NIF</small>
                <span>{extractedData.nifFornecedor}</span>
              </div>
            )}
            {extractedData.categoria && (
              <div>
                <small>Categoria</small>
                <span>{extractedData.categoria}</span>
              </div>
            )}
            <div>
              <small>Nº Documento</small>
              <b>{extractedData.numero || "—"}</b>
            </div>
            <div>
              <small>Data</small>
              <span>{extractedData.data || "—"}</span>
            </div>
            <div>
              <small>Valor Total</small>
              <b style={{ color: "#d85b2b" }}>
                {extractedData.valorTotal != null ? money(extractedData.valorTotal) : "—"}
              </b>
            </div>
          </div>

          {extractedData.documentUrl && extractedData.documentUrl.startsWith("http") && (
            <div className="ocr-document-link">
              <FileText size={14} />
              <a href={extractedData.documentUrl} target="_blank" rel="noopener noreferrer">
                Ver documento original guardado no arquivo
              </a>
            </div>
          )}

          <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="button-ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: "11px" }}
            >
              Carregar outro documento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
