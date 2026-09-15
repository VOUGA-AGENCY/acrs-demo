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
import type { Invoice } from "@/types";
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
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
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
        registadoEm: new Date().toISOString(),
        utilizador: profile,
      };
      setState({
        ...state,
        invoices: invoice
          ? state.invoices.map((i) => (i.id === invoice.id ? saved : i))
          : [saved, ...state.invoices],
      });
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
          <label className="upload-zone">
            <span>
              <Camera size={28} />
            </span>
            <b>
              {field ? "Tirar fotografia ou carregar" : "Carregar documento"}
            </b>
            <p>PDF ou imagem · apenas para esta demonstração</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture={field ? "environment" : undefined}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0].name);
                  setStage(1);
                }
              }}
            />
          </label>
          <button className="sample-button" onClick={example}>
            <FileText size={16} /> Utilizar documento de exemplo{" "}
            <ArrowRight size={15} />
          </button>
          <Note>
            Simulação local. Não é feita leitura automática nem enviado qualquer
            ficheiro.
          </Note>
        </>
      ) : (
        <>
          <div className="attached-file">
            <FileText size={19} />
            <span>{file}</span>
            <button onClick={() => setStage(0)}>Alterar</button>
          </div>
          <Note tone="amber">
            Preenchimento demonstrativo. Confirme ou introduza os dados do
            documento.
          </Note>
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
  const { state, setState, notify } = useStore();
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
                      rejeitadoPor: "João Catalão",
                    };
                    setState({
                      ...state,
                      invoices: state.invoices.map((i) =>
                        i.id === selected.id ? rejected : i,
                      ),
                    });
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
                        "João Catalão",
                      );
                      setState(next);
                      setSelected(
                        next.invoices.find((i) => i.id === selected.id) ?? null,
                      );
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
          <div className="document-label">DOCUMENTO DEMONSTRATIVO</div>
          <h3>{invoice.fornecedor}</h3>
          <p>Fatura {invoice.numero}</p>
          <DetailList
            items={[
              ["Data", date(invoice.data)],
              ["Destino", invoice.tipo],
              ["Valor", money(invoice.valor)],
              ["Obra", invoice.obraId || "Stock do armazém"],
              ["Utilizador", invoice.utilizador ?? "Registo histórico"],
            ]}
          />
          <small>
            {invoice.documento ?? "Documento original não fornecido."}
          </small>
        </div>
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
