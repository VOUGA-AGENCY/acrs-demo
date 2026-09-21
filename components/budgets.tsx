"use client";
import { useState } from "react";
import { Plus, Calculator, Check } from "lucide-react";
import { useStore } from "./store";
import { workFinancials } from "@/lib/engine";
import { includes, money, num, sum } from "@/lib/format";
import type { Budget } from "@/types";
import { persistBudgetToSupabase } from "@/lib/supabase/service";
import { WorkSelector } from "./warehouse";
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
  Table,
} from "./ui";
const cats = [
  "Mão de obra",
  "Materiais",
  "Ferramentaria",
  "Transportes",
  "Alojamento",
  "Outros",
];
export function BudgetForm({
  budget,
  onClose,
}: {
  budget?: Budget;
  onClose: () => void;
}) {
  const { state, setState, notify, profile } = useStore();
  const [work, setWork] = useState(budget?.obraId ?? "");
  const [mode, setMode] = useState(budget?.modo ?? "Simples");
  const [value, setValue] = useState(budget?.valor ?? 100000);
  const [margin, setMargin] = useState((budget?.margem ?? 0.2) * 100);
  const [lines, setLines] = useState(
    cats.map((c) => ({
      categoria: c,
      valor: budget?.linhas.find((l) => l.categoria === c)?.valor ?? 0,
    })),
  );
  const [error, setError] = useState("");
  function save() {
    if (
      !work ||
      value <= 0 ||
      margin < 0 ||
      margin >= 100 ||
      !Number.isFinite(value) ||
      !Number.isFinite(margin) ||
      lines.some((l) => !Number.isFinite(l.valor) || l.valor < 0)
    ) {
      setError("Selecione obra, valor positivo e margem entre 0% e 99%.");
      return;
    }
    const b: Budget = {
      obraId: work,
      valor: value,
      margem: margin / 100,
      modo: mode,
      linhas: mode === "Discriminado" ? lines : [],
      source: "demo",
    };
    setState({
      ...state,
      budgets: [...state.budgets.filter((x) => x.obraId !== work), b],
    });
    persistBudgetToSupabase(b, profile).catch(console.error);
    notify("Orçamento guardado. Limite e margem da obra atualizados.");
    onClose();
  }
  return (
    <Modal
      title={budget ? "Editar orçamento" : "Novo orçamento"}
      onClose={onClose}
    >
      <div className="modal-body">
        <Field label="Modo de orçamento">
          <div className="choice-row">
            {["Simples", "Discriminado"].map((m) => (
              <button
                key={m}
                className={mode === m ? "active" : ""}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Obra">
          <WorkSelector value={work} onChange={setWork} />
        </Field>
        <Field label="Cliente">
          <input
            value={
              state.works.find((w) => w.id === work)?.cliente ?? "Por confirmar"
            }
            disabled
          />
        </Field>
        <div className="form-grid">
          <Field label="Valor comercial proposto (€)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </Field>
          <Field label="Margem alvo (%)">
            <input
              type="number"
              min="0"
              max="99"
              step="0.1"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
            />
          </Field>
        </div>
        {mode === "Discriminado" && (
          <>
            <h3 className="small-title">Custos previstos por componente</h3>
            <div className="form-grid">
              {lines.map((l, i) => (
                <Field key={l.categoria} label={`${l.categoria} (€)`}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.valor}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) =>
                          j === i ? { ...x, valor: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </Field>
              ))}
            </div>
            <DetailList
              items={[
                [
                  "Total de custos previstos",
                  money(sum(lines, (l) => l.valor)),
                ],
              ]}
            />
            {sum(lines, (l) => l.valor) > value * (1 - margin / 100) && (
              <Note tone="amber">
                Os custos previstos ultrapassam o máximo compatível com a margem
                alvo.
              </Note>
            )}
          </>
        )}
        <div className="budget-result">
          <Calculator size={24} />
          <div>
            <span>Custo máximo admissível</span>
            <strong>{money(value * (1 - margin / 100))}</strong>
            <small>
              {money(value)} × (1 − {num(margin)}%)
            </small>
          </div>
        </div>
        <Note>
          Orçamento demonstrativo. Guardar substitui o orçamento atual desta
          obra, sem duplicar custos.
        </Note>
        {error && <Note tone="red">{error}</Note>}
        <div className="form-actions">
          <Button secondary onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>
            Guardar orçamento <Check size={16} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function Budgets() {
  const { state, ledger } = useStore();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Budget | null | undefined>(undefined);
  const rows = state.budgets.filter((b) => {
    const w = state.works.find((w) => w.id === b.obraId);
    return includes(`${b.obraId} ${w?.nome}`, q);
  });
  return (
    <>
      <PageHeader
        eyebrow="PLANEAMENTO"
        title="Orçamentos"
        description="Defina o limite de custo antes de acompanhar a execução."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} /> Novo orçamento
          </Button>
        }
      />
      <div className="metrics four">
        <Metric
          label="Valor comercial"
          value={money(sum(state.budgets, (b) => b.valor))}
        />
        <Metric
          label="Custo máximo global"
          value={money(sum(state.budgets, (b) => b.valor * (1 - b.margem)))}
        />
        <Metric
          label="Custo atual"
          value={money(sum(ledger, (c) => c.valor))}
        />
        <Metric
          label="Orçamentos"
          value={state.budgets.length}
          hint="Valores demonstrativos"
        />
      </div>
      <div className="filter-bar">
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar obra…" />
      </div>
      <Table
        rows={rows}
        onRow={setEditing}
        columns={[
          {
            label: "Obra",
            render: (b) => (
              <b>
                {b.obraId} · {state.works.find((w) => w.id === b.obraId)?.nome}
              </b>
            ),
          },
          { label: "Cliente", render: (b) => state.works.find((w) => w.id === b.obraId)?.cliente ?? "Cliente demo" },
          { label: "Modo", render: (b) => b.modo },
          { label: "Valor", render: (b) => money(b.valor), align: "right" },
          {
            label: "Margem alvo",
            render: (b) => `${num(b.margem * 100)}%`,
            align: "right",
          },
          {
            label: "Custo máximo",
            render: (b) => money(b.valor * (1 - b.margem)),
            align: "right",
          },
          {
            label: "Custo atual",
            render: (b) => money(workFinancials(state, b.obraId, ledger).cost),
            align: "right",
          },
          {
            label: "Estado",
            render: (b) => (
              <Badge>{workFinancials(state, b.obraId, ledger).risk}</Badge>
            ),
          },
        ]}
      />
      {editing !== undefined && (
        <BudgetForm
          budget={editing ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
