"use client";
import { useState } from "react";
import {
  Camera,
  Upload,
  Plus,
  FileText,
  Check,
  ArrowRight,
} from "lucide-react";
import { useStore } from "./store";
import { validateInvoice } from "@/lib/engine";
import { date, includes, money, today, uid } from "@/lib/format";
import { ArticleSelector, WorkSelector } from "./warehouse";
import { persistInvoiceToSupabase } from "@/lib/supabase/service";
import {
  Badge,
  Button,
  DetailList,
  Field,
  Metric,
  Modal,
  Note,
  PageHeader,
  SearchInput,
  Select,
  Table,
  Tabs,
} from "./ui";
import { OCRUpload } from "./ocr-upload";
import type { Invoice, InvoiceItem, OCRResult } from "@/types";
const directCategories = [
  "Alimentação",
  "Alojamento",
  "Combustível",
  "Ferramentaria",
  "Transportes",
  "Outros",
];
export function InvoiceForm({
  onClose,
  field = false,
  invoice,
  onSaved,
}: {
  onClose: () => void;
  field?: boolean;
  invoice?: Invoice;
  onSaved?: (invoice: Invoice) => void;
}) {
  const { state, setState, profile, notify } = useStore();
  const [stage, setStage] = useState(invoice ? 1 : 0);
  const [file, setFile] = useState(invoice?.documento ?? "");
  const [work, setWork] = useState(invoice?.obraId ?? "");
  const [supplier, setSupplier] = useState(invoice?.fornecedor ?? "");
  const [number, setNumber] = useState(invoice?.numero ?? "");
  const [effective, setEffective] = useState(invoice?.data ?? today());
  const [amount, setAmount] = useState(invoice?.valor ?? 0);
  const [category, setCategory] = useState(invoice?.categoria ?? "Alimentação");
  const [type, setType] = useState<Invoice["tipo"]>(
    invoice?.tipo ?? "Despesa de obra",
  );
  const [article, setArticle] = useState(invoice?.artigoId ?? "");
  const [quantity, setQuantity] = useState(invoice?.quantidade ?? 1);
  const [ocrStatus, setOcrStatus] = useState<Invoice["ocrStatus"]>(invoice?.ocrStatus);
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>(invoice?.ocrConfidence);
  const [ocrRaw, setOcrRaw] = useState<any>(invoice?.ocrRaw);
  const [lines, setLines] = useState<InvoiceItem[]>(invoice?.items ?? []);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function handleOcrExtracted(ocr: OCRResult) {
    if (ocr.documentUrl) setFile(ocr.documentUrl);
    if (ocr.fornecedor) setSupplier(ocr.fornecedor);
    if (ocr.numero) setNumber(ocr.numero);
    if (ocr.data) setEffective(ocr.data);
    if (ocr.valorTotal != null && ocr.valorTotal > 0) setAmount(ocr.valorTotal);
    if (ocr.confidence != null) setOcrConfidence(ocr.confidence);
    if (ocr.rawText) setOcrRaw(ocr.rawText);
    if (ocr.linhas && ocr.linhas.length > 0) {
      setLines(
        ocr.linhas.map((l) => ({
          descricao: l.descricao,
          quantidade: l.quantidade,
          precoUnitario: l.precoUnitario,
          subtotal: l.subtotal,
          ivaTaxa: ocr.ivaTaxa ?? 23,
        })),
      );
    }
    setOcrStatus("NEEDS_REVIEW");
    setStage(1);
    notify("Leitura da fatura por OCR concluída! Confirme os dados.");
  }

  function example() {
    setFile("documento-exemplo.pdf");
    setSupplier(
      state.invoices.find((i) => /refei|aliment/i.test(i.categoria ?? ""))
        ?.fornecedor ?? state.invoices[0].fornecedor,
    );
    setNumber(
      `DEMO-${state.invoices.filter((i) => i.source === "demo").length + 1}`,
    );
    setAmount(48.5);
    setStage(1);
  }
  function submit() {
    try {
      if (!work && type === "Despesa de obra")
        throw new Error("Selecione a obra.");
      if (!file) throw new Error("Escolha um documento ou utilize o exemplo.");
      if (
        !supplier.trim() ||
        !number.trim() ||
        !effective ||
        amount <= 0 ||
        !Number.isFinite(amount)
      )
        throw new Error("Preencha fornecedor, número, data e valor.");
      if (
        type === "Compra para stock" &&
        (!article || quantity <= 0 || !Number.isFinite(quantity))
      )
        throw new Error("Associe um artigo e uma quantidade válida.");
      const saved: Invoice = {
        ...invoice,
        id: invoice?.id ?? uid("fatura"),
        data: effective,
        fornecedor: supplier,
        numero: number,
        obraId: type === "Compra para stock" ? "" : work,
        categoria: category,
        valor: amount,
        source: "demo",
        estado: invoice?.estado ?? "Por validar",
        tipo: type,
        documento: file,
        artigoId: article,
        quantidade: quantity,
        ocrStatus: ocrConfidence != null ? "CONFIRMED" : (invoice?.ocrStatus ?? "MANUAL"),
        ocrConfidence,
        ocrRaw,
        items: lines,
        registadoEm: new Date().toISOString(),
        utilizador: profile,
      };
      setState({
        ...state,
        invoices: invoice
          ? state.invoices.map((i) => (i.id === invoice.id ? saved : i))
          : [saved, ...state.invoices],
      });
      persistInvoiceToSupabase(saved, profile).catch(console.error);
      onSaved?.(saved);
      notify(
        invoice
          ? "Dados da fatura corrigidos."
          : field
            ? "Despesa enviada para validação."
            : "Fatura adicionada para validação.",
      );
      if (field) setDone(true);
      else onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const body = done ? (
    <div className="success-view">
      <div className="success-icon">
        <Check size={35} />
      </div>
      <h2>Despesa enviada.</h2>
      <p>O documento ficou associado à obra {work}, por validar.</p>
      <Button onClick={onClose}>Enviar outra despesa</Button>
    </div>
  ) : (
    <div className={field ? "field-form" : "modal-body"}>
      {field && (
        <>
          <Field label="Obra">
            <WorkSelector value={work} onChange={setWork} />
          </Field>
          <h2>Documento da despesa</h2>
        </>
      )}
      {stage === 0 ? (
        <>
          <OCRUpload onExtracted={handleOcrExtracted} compact={field} />
          <div style={{ textAlign: "center", margin: "14px 0 8px", color: "#8a949d", fontSize: "11px" }}>
            — ou em alternativa —
          </div>
          <button type="button" className="sample-button" onClick={example}>
            <FileText size={16} /> Preenchimento manual sem documento{" "}
            <ArrowRight size={15} />
          </button>
        </>
      ) : (
        <>
          <div className="attached-file">
            <FileText size={19} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{file}</span>
            {file.startsWith("http") && (
              <a
                href={file}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "11px", color: "#d85b2b", marginLeft: "auto", marginRight: "8px" }}
              >
                Abrir ficheiro
              </a>
            )}
            <button type="button" onClick={() => setStage(0)}>Alterar</button>
          </div>
          {ocrConfidence != null ? (
            <Note tone="green">
              Dados pré-preenchidos por OCR LlamaParse com {ocrConfidence}% de confiança. Confirme e selecione a Obra/Categoria.
            </Note>
          ) : (
            <Note tone="amber">
              Preenchimento manual. Confirme ou introduza os dados do documento.
            </Note>
          )}
          <div className="form-grid">
            <Field label="Fornecedor">
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </Field>
            <Field label="Nº da fatura">
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="FT 2026/…"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
              />
            </Field>
            <Field label="Valor (€)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Categoria">
            {type === "Compra para stock" ? (
              <input value="Materiais" disabled />
            ) : (
              <Select
                label="Categoria da fatura"
                value={category}
                onChange={setCategory}
                options={directCategories}
              />
            )}
          </Field>
          {!field && (
            <>
              <Field label="Destino">
                <div className="choice-row">
                  <button
                    className={type === "Despesa de obra" ? "active" : ""}
                    onClick={() => {
                      setType("Despesa de obra");
                      if (category === "Materiais") setCategory("Outros");
                    }}
                  >
                    Despesa direta de obra
                  </button>
                  <button
                    className={type === "Compra para stock" ? "active" : ""}
                    onClick={() => {
                      setType("Compra para stock");
                      setCategory("Materiais");
                    }}
                  >
                    Compra para stock
                  </button>
                </div>
              </Field>
              {type === "Despesa de obra" ? (
                <Field label="Obra">
                  <WorkSelector value={work} onChange={setWork} />
                </Field>
              ) : (
                <>
                  <Field label="Artigo">
                    <ArticleSelector value={article} onChange={setArticle} />
                  </Field>
                  <Field label="Quantidade recebida">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </Field>
                  <Note>
                    Depois de validada, esta compra gera uma entrada em stock. O
                    custo será imputado à obra quando o material sair.
                  </Note>
                </>
              )}
            </>
          )}
          {lines.length > 0 && (
            <div className="ocr-lines-preview" style={{ margin: "14px 0" }}>
              <small>Artigos / Linhas na fatura ({lines.length})</small>
              <table className="ocr-mini-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th style={{ textAlign: "right" }}>Qtd</th>
                    <th style={{ textAlign: "right" }}>P. Unit</th>
                    <th style={{ textAlign: "right" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx}>
                      <td>{l.descricao}</td>
                      <td style={{ textAlign: "right" }}>{l.quantidade}</td>
                      <td style={{ textAlign: "right" }}>{money(l.precoUnitario)}</td>
                      <td style={{ textAlign: "right" }}>{money(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && <Note tone="red">{error}</Note>}
          <div className="form-actions">
            {!field && (
              <Button secondary onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button onClick={submit}>
              {invoice
                ? "Guardar correções"
                : field
                  ? "Submeter despesa"
                  : "Adicionar fatura"}{" "}
              <Check size={16} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
  return field ? (
    body
  ) : (
    <Modal title={invoice ? "Corrigir fatura" : "Adicionar fatura"} onClose={onClose}>
      {body}
    </Modal>
  );
}
export function Invoices({ initialType }: { initialType?: Invoice["tipo"] }) {
  const { state, setState, profile, notify } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [activeType, setActiveType] = useState<Invoice["tipo"]>(
    initialType ?? "Despesa de obra",
  );
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const rows = state.invoices.filter(
    (i) =>
      includes(`${i.fornecedor} ${i.numero} ${i.obraId} ${i.categoria}`, q) &&
      (!status || i.estado === status) &&
      i.tipo === activeType,
  );
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Faturas & Compras"
        description="Documentos de obra e compras para stock numa única operação."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={17} /> Adicionar fatura
          </Button>
        }
      />
      <Tabs
        items={["Faturas", "Compras"]}
        value={activeType === "Compra para stock" ? "Compras" : "Faturas"}
        onChange={(tab) =>
          setActiveType(tab === "Compras" ? "Compra para stock" : "Despesa de obra")
        }
      />
      <div className="metrics four">
        <Metric
          label="Documentos"
          value={state.invoices.length}
          hint="Histórico selecionado + sessão"
        />
        <Metric
          label="Por validar"
          value={
            state.invoices.filter((i) => i.estado === "Por validar").length
          }
          hint="Estado demonstrativo"
          onClick={() => setStatus("Por validar")}
        />
        <Metric
          label="Despesas de obra"
          value={
            state.invoices.filter((i) => i.tipo === "Despesa de obra").length
          }
        />
        <Metric
          label="Compras para stock"
          value={
            state.invoices.filter((i) => i.tipo === "Compra para stock").length
          }
        />
      </div>
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar fornecedor, fatura, categoria ou obra…"
        />
        <Select
          label="Estado da fatura"
          value={status}
          onChange={setStatus}
          placeholder="Todos os estados"
          options={["Validada", "Por validar", "Rejeitada"]}
        />
      </div>
      <Table
        rows={[...rows].sort((a, b) => b.data.localeCompare(a.data))}
        onRow={setSelected}
        columns={[
          { label: "Data", render: (i) => date(i.data) },
          { label: "Fornecedor", render: (i) => <b>{i.fornecedor}</b> },
          { label: "Nº Fatura", render: (i) => i.numero },
          { label: "Obra", render: (i) => i.obraId || "Armazém" },
          { label: "Categoria", render: (i) => i.categoria ?? "Por confirmar" },
          { label: "Valor", render: (i) => money(i.valor), align: "right" },
          { label: "Tipo", render: (i) => i.tipo },
          { label: "Estado", render: (i) => <Badge>{i.estado}</Badge> },
        ]}
      />
      {adding && <InvoiceForm onClose={() => setAdding(false)} />}
      <p className="footnote">
        Documentos por validar não alteram custos nem stock. Validar aplica o
        efeito correspondente e mantém a origem rastreável.
      </p>
      {selected && (
        <Modal
          title="Detalhe da fatura"
          drawer
          onClose={() => setSelected(null)}
        >
          <div className="drawer-body">
            <div className="detail-hero">
              <Badge>{selected.estado}</Badge>
              <h3>{selected.fornecedor}</h3>
              <strong>{money(selected.valor)}</strong>
            </div>
            <DetailList
              items={[
                ["Nº fatura", selected.numero],
                ["Data", date(selected.data)],
                ["Obra", selected.obraId || "Armazém"],
                ["Categoria", selected.categoria],
                ["Destino", selected.tipo],
              ]}
            />
            {selected.sourceRef && (
              <Note>
                Excel · {selected.sourceRef.sheet} · linha{" "}
                {selected.sourceRef.row}
              </Note>
            )}
            <div className="document">
              <div className="document-label">
                PRÉ-VISUALIZAÇÃO DEMONSTRATIVA
              </div>
              <h3>{selected.fornecedor}</h3>
              <p>Fatura {selected.numero}</p>
              <DetailList
                items={[
                  ["Data", date(selected.data)],
                  ["Total", money(selected.valor)],
                ]}
              />
              <small>
                {selected.documento ??
                  "Documento original não fornecido. Representação do registo."}
              </small>
            </div>
            {selected.estado === "Por validar" && (
              <div className="form-actions">
                <Button secondary onClick={() => setEditing(selected)}>
                  Corrigir dados
                </Button>
                <Button
                  secondary
                  onClick={() => {
                    const rejected = {
                      ...selected,
                      estado: "Rejeitada" as const,
                      rejeitadoEm: new Date().toISOString(),
                      rejeitadoPor: profile,
                    };
                    setState({
                      ...state,
                      invoices: state.invoices.map((i) =>
                        i.id === selected.id ? rejected : i,
                      ),
                    });
                    persistInvoiceToSupabase(rejected, profile).catch(console.error);
                    setSelected(rejected);
                    notify("Fatura rejeitada sem efeitos em custos ou stock.");
                  }}
                >
                  Rejeitar
                </Button>
                <Button
                  onClick={() => {
                    try {
                      const next = validateInvoice(
                        state,
                        selected.id,
                        profile,
                      );
                      setState(next);
                      const validated = next.invoices.find((i) => i.id === selected.id) ?? null;
                      if (validated) {
                        persistInvoiceToSupabase(validated, profile).catch(console.error);
                      }
                      setSelected(validated);
                      notify("Fatura validada. Efeitos aplicados.");
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <Check size={16} /> Validar fatura
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
      {editing && (
        <InvoiceForm
          invoice={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setSelected(saved);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
export function FieldPage() {
  const [key, setKey] = useState(0);
  return (
    <div className="field-page">
      <PageHeader
        eyebrow="CAMPO"
        title="Enviar uma despesa"
        description="Associe o documento à obra certa."
      />
      <InvoiceForm key={key} field onClose={() => setKey(key + 1)} />
      <p className="footnote">Demonstração · envio simulado nesta sessão.</p>
    </div>
  );
}
export function DocumentPreview({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const { state } = useStore();
  const entries = state.movements.filter((m) => m.origemId === invoice.id);
  return (
    <Modal title="Documento e registo de origem" drawer onClose={onClose}>
      <div className="drawer-body">
        <div className="document">
          <div className="document-label">
            {invoice.ocrStatus ? `DOCUMENTO DIGITALIZADO (${invoice.ocrStatus})` : "DOCUMENTO ARQUIVADO"}
          </div>
          <h3>{invoice.fornecedor}</h3>
          <p>Fatura {invoice.numero || "Sem número"}</p>
          <DetailList
            items={[
              ["Data", date(invoice.data)],
              ["Destino", invoice.tipo],
              ["Valor", money(invoice.valor)],
              ["Obra", invoice.obraId || "Stock do armazém"],
              ["Estado", invoice.estado],
              ["OCR", invoice.ocrConfidence ? `${invoice.ocrConfidence}% de confiança` : (invoice.ocrStatus || "Manual")],
              ["Utilizador", invoice.utilizador ?? "Registo do sistema"],
            ]}
          />
          {invoice.documento && invoice.documento.startsWith("http") ? (
            <div style={{ marginTop: "12px" }}>
              <a
                href={invoice.documento}
                target="_blank"
                rel="noopener noreferrer"
                className="button-ghost"
                style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FileText size={14} /> Ver documento digitalizado no arquivo
              </a>
            </div>
          ) : (
            <small>
              {invoice.documento ?? "Documento original não fornecido."}
            </small>
          )}
        </div>
        {invoice.items && invoice.items.length > 0 && (
          <div className="ocr-lines-preview" style={{ marginTop: "14px" }}>
            <small>Linhas da Fatura ({invoice.items.length})</small>
            <table className="ocr-mini-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th style={{ textAlign: "right" }}>Qtd</th>
                  <th style={{ textAlign: "right" }}>P. Unit</th>
                  <th style={{ textAlign: "right" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.descricao}</td>
                    <td style={{ textAlign: "right" }}>{it.quantidade}</td>
                    <td style={{ textAlign: "right" }}>{money(it.precoUnitario)}</td>
                    <td style={{ textAlign: "right" }}>{money(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries.map((m) => (
          <div className="history-card" key={m.id}>
            <b>
              {m.tipo} · {m.descricao}
            </b>
            <span>
              {m.quantidade} × {money(m.valorUnitario)}
            </span>
            <span>
              {date(m.data)} · {m.id}
            </span>
          </div>
        ))}
        {invoice.tipo === "Compra para stock" && (
          <Note>
            O valor está associado à entrada de stock. Só uma saída posterior
            cria custo numa obra.
          </Note>
        )}
      </div>
    </Modal>
  );
}
