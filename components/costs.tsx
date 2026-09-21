"use client";
import type { Cost } from "@/types/index";
import { useStore } from "./store";
import { date, money, num, qty, sum } from "@/lib/format";
import { Badge, DetailList, Modal, Note, Table } from "./ui";
export function CostTable({
  rows,
  onSelect,
}: {
  rows: Cost[];
  onSelect: (c: Cost) => void;
}) {
  const { state } = useStore();
  return (
    <Table
      rows={rows}
      onRow={onSelect}
      columns={[
        { label: "Data", render: (c) => date(c.data) },
        { label: "Origem", render: (c) => <Badge>{c.origem}</Badge> },
        { label: "Descrição", render: (c) => <b>{c.descricao}</b> },
        { label: "Categoria", render: (c) => c.categoria },
        {
          label: "Quantidade",
          render: (c) => {
            const movement = state.movements.find((m) => m.id === c.origemId);
            const article = movement
              ? state.articles.find((a) => a.id === movement.artigoId)
              : undefined;
            return article ? qty(c.quantidade, article) : num(c.quantidade, 3);
          },
          align: "right",
        },
        {
          label: "Valor",
          render: (c) => (
            <strong className={c.valor < 0 ? "positive" : ""}>
              {money(c.valor)}
            </strong>
          ),
          align: "right",
        },
        {
          label: "Utilizador",
          render: (c) => <span className="muted">{c.utilizador}</span>,
        },
      ]}
    />
  );
}
export function CostDetail({
  cost,
  onClose,
}: {
  cost: Cost;
  onClose: () => void;
}) {
  const { state } = useStore();
  const work = state.works.find((w) => w.id === cost.obraId);
  const invoice = state.invoices.find((i) => i.id === cost.origemId);
  const movement = state.movements.find((m) => m.id === cost.origemId);
  const article = movement
    ? state.articles.find((a) => a.id === movement.artigoId)
    : undefined;
  return (
    <Modal title="Origem do custo" drawer onClose={onClose}>
      <div className="drawer-body">
        <div className="detail-hero">
          <Badge>{cost.origem}</Badge>
          <h3>{cost.descricao}</h3>
          <strong>{money(cost.valor)}</strong>
        </div>
        <DetailList
          items={[
            ["Obra", `${work?.numero} · ${work?.nome}`],
            ["Categoria", cost.categoria],
            ["Data efetiva", date(cost.data)],
            [
              "Data de registo",
              cost.registadoEm
                ? date(cost.registadoEm)
                : "Não disponível no histórico",
            ],
            [
              "Quantidade",
              article ? qty(cost.quantidade, article) : num(cost.quantidade, 3),
            ],
            ["Valor base unitário", money(cost.valorUnitario)],
            ["Utilizador", cost.utilizador],
            ["Referência", cost.origemId],
          ]}
        />
        {cost.sourceRef && (
          <Note>
            Fonte: {cost.sourceRef.file} · {cost.sourceRef.sheet} · linha{" "}
            {cost.sourceRef.row}
          </Note>
        )}
        {cost.nota && <Note tone="amber">{cost.nota}</Note>}
        {invoice && (
          <div className="document">
            <div className="document-label">DOCUMENTO DEMONSTRATIVO</div>
            <h3>{invoice.fornecedor}</h3>
            <p>Fatura {invoice.numero}</p>
            <hr />
            <DetailList
              items={[
                ["Data", date(invoice.data)],
                ["Categoria", invoice.categoria],
                ["Total", money(invoice.valor)],
              ]}
            />
            <small>
              Representação do registo. O documento original não foi fornecido.
            </small>
          </div>
        )}
      </div>
    </Modal>
  );
}
const colors = [
  "#e76735",
  "#334155",
  "#7697a0",
  "#b3bdc6",
  "#d29b50",
  "#8a908e",
  "#c6c7c8",
];
export function CostBreakdown({
  costs,
  onCategory,
}: {
  costs: Cost[];
  onCategory?: (v: string) => void;
}) {
  const cats = [
    "Mão de obra",
    "Materiais",
    "Ferramentaria",
    "Alojamento",
    "Alimentação",
    "Combustível",
    "Outros",
  ];
  const total = sum(costs, (c) => c.valor);
  return (
    <div className="breakdown">
      <div className="stacked-bar">
        {cats.map((cat, i) => {
          const value = sum(
            costs.filter((c) => c.categoria === cat),
            (c) => c.valor,
          );
          return value > 0 ? (
            <span
              key={cat}
              style={{
                width: `${(value / Math.max(total, 1)) * 100}%`,
                background: colors[i],
              }}
            />
          ) : null;
        })}
      </div>
      {cats.map((cat, i) => {
        const value = sum(
          costs.filter((c) => c.categoria === cat),
          (c) => c.valor,
        );
        return (
          <button
            key={cat}
            onClick={() => onCategory?.(cat)}
            className="breakdown-row"
          >
            <span>
              <i style={{ background: colors[i] }} />
              {cat}
            </span>
            <span>
              <b>{money(value)}</b>
              <small>{num(total ? (value / total) * 100 : 0, 1)}%</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
