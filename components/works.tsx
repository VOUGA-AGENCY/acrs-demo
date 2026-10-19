"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";  
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  MapPin,
  TriangleAlert,
  Plus,
  Pencil,
  CheckCircle2,
  RotateCcw,
  Calculator,
  Package,
  FileText,
  Printer,
} from "lucide-react";
import { useStore } from "./store";
import {
  Badge,
  Button,
  DetailList,
  Field,
  Metric,
  Note,
  PageHeader,
  Modal,
  Panel,
  Progress,
  SearchInput,
  Select,
  Table,
  Tabs,
} from "./ui";
import { CostBreakdown, CostDetail, CostTable } from "./costs";
import {
  applyMovement,
  canManageCentralWarehouse,
  canManageWorkContainer,
  containerArticles,
  containerStock,
  days,
  effectivePolicy,
  stock,
  timeCost,
  workFinancials,
} from "@/lib/engine";
import { date, includes, money, num, qty, sum, today, uid } from "@/lib/format";
import type { Budget, Cost, Invoice, Movement, Work } from "@/types/index";
import {
  persistBudgetToSupabase,
  persistMovementToSupabase,
  persistWorkToSupabase,
} from "@/lib/supabase/service";
import { InvoiceDrawer } from "./invoices";
import { BudgetForm } from "./budgets";

const budgetRubric = (category: string) =>
  ["Mão de obra", "Materiais", "Ferramentaria", "Transportes", "Alojamento"].includes(
    category,
  )
    ? category
    : "Outros";
const consumptionTone = (value: number) =>
  value >= 1 ? "red" : value >= 0.8 ? "orange" : value >= 0.7 ? "amber" : "green";

function WorkForm({ work, onClose }: { work?: Work; onClose: () => void }) {
  const { state, setState, notify, profile } = useStore();
  const [number, setNumber] = useState(work?.numero ?? "");
  const [name, setName] = useState(work?.nome ?? "");
  const [client, setClient] = useState(work?.cliente ?? "Por confirmar");
  const [location, setLocation] = useState(work?.local ?? "");
  const [status, setStatus] = useState(work?.estado ?? "Em curso");
  const [start, setStart] = useState(work?.dataInicio ?? "");
  const [end, setEnd] = useState(work?.dataFim ?? "");
  const [authorizedUsers, setAuthorizedUsers] = useState(work?.quemPodeMovimentar ?? "");
  const [hasContainer, setHasContainer] = useState(work?.contentorEmObra ?? false);
  const [budgetValue, setBudgetValue] = useState(15000);
  const [budgetMargin, setBudgetMargin] = useState(20);
  const [error, setError] = useState("");

  async function save() {
    if (!number.trim() || !name.trim()) {
      setError("Indique o número e o nome da obra.");
      return;
    }
    const exists = state.works.some(
      (w) => w.numero.trim().toLowerCase() === number.trim().toLowerCase() && w.id !== work?.id,
    );
    if (exists) {
      setError("Já existe uma obra com este número.");
      return;
    }
    const workId = work?.id ?? uid("obra");
    const effectiveEnd = status === "Concluída" ? (end || today()) : (end || null);
    const saved: Work = {
      id: workId,
      numero: number.trim(),
      nome: name.trim(),
      cliente: client.trim() || "Por confirmar",
      local: location.trim() || null,
      estado: status,
      dataInicio: start || undefined,
      dataFim: effectiveEnd,
      quemPodeMovimentar: authorizedUsers.trim() || undefined,
      contentorEmObra: hasContainer,
      source: work?.source ?? "ACRS",
    };
    try {
      await persistWorkToSupabase(saved, profile);
      let updatedBudgets = state.budgets;
      if (!work) {
        const val = Number(budgetValue) > 0 ? Number(budgetValue) : 15000;
        const marg = Number(budgetMargin) >= 0 && Number(budgetMargin) < 100 ? Number(budgetMargin) / 100 : 0.20;
        const newBudget: Budget = {
          obraId: workId,
          valor: val,
          margem: marg,
          modo: "Simples",
          linhas: [],
          source: "ACRS",
        };
        await persistBudgetToSupabase(newBudget, profile);
        updatedBudgets = [...state.budgets.filter((b) => b.obraId !== workId), newBudget];
      }
      setState({
        ...state,
        works: work
          ? state.works.map((w) => (w.id === work.id ? saved : w))
          : [...state.works.filter((w) => w.id !== saved.id), saved],
        budgets: updatedBudgets,
      });
      notify(work ? "Obra atualizada com sucesso." : "Obra e orçamento criados com sucesso.");
      onClose();
    } catch (err: any) {
      console.error("Erro ao guardar obra:", err);
      setError(`Erro ao guardar obra: ${err?.message || err}`);
    }
  }

  return (
    <Modal title={work ? "Editar obra" : "Nova obra"} onClose={onClose}>
      <div className="modal-body">
        <div className="form-grid">
          <Field label="Número da obra">
            <input value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Cliente">
            <input value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <Field label="Local">
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Estado">
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value;
                setStatus(next);
                if (next === "Concluída" && !end) setEnd(today());
              }}
            >
              <option>Em preparação</option>
              <option>Em curso</option>
              <option>Suspensa</option>
              <option>Concluída</option>
            </select>
          </Field>
          <Field label="Data de início">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Data de fim">
            <input type="date" value={end ?? ""} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Contentor na obra">
            <select
              value={hasContainer ? "sim" : "nao"}
              onChange={(e) => setHasContainer(e.target.value === "sim")}
            >
              <option value="nao">Nao</option>
              <option value="sim">Sim</option>
            </select>
          </Field>
          <Field label="Quem pode movimentar material">
            <input
              placeholder="Ex: armazem@acrs.pt; encarregado@acrs.pt"
              value={authorizedUsers}
              onChange={(e) => setAuthorizedUsers(e.target.value)}
            />
          </Field>
          {!work && (
            <>
              <Field label="Valor orçamentado inicial (€)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(Number(e.target.value))}
                />
              </Field>
              <Field label="Margem alvo prevista (%)">
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  value={budgetMargin}
                  onChange={(e) => setBudgetMargin(Number(e.target.value))}
                />
              </Field>
            </>
          )}
        </div>
        <Note>A obra e o orçamento são sincronizados diretamente com o Supabase.</Note>
        {error && <Note tone="red">{error}</Note>}
        <div className="form-actions">
          <Button secondary onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Guardar obra</Button>
        </div>
      </div>
    </Modal>
  );
}
export function WorkTable({
  rows,
  compact = false,
}: {
  rows: Work[];
  compact?: boolean;
}) {
  const { state, ledger, profile, authUser } = useStore();
  const router = useRouter();
  const isSecretariado = authUser?.perfil === "secretariado";
  return (
    <Table
      rows={rows}
      onRow={(w) => router.push(`/obras/${w.id}`)}
      columns={[
        {
          label: "Nº / Obra",
          render: (w) => (
            <div className="work-cell">
              <span className="work-icon">
                <Building2 size={18} />
              </span>
              <div>
                <b>
                  {w.numero} <span className="separator">/</span> {w.nome}
                </b>
                <small>
                  {w.cliente === "Por confirmar"
                    ? "Cliente por confirmar"
                    : w.cliente}
                  {w.contentorEmObra ? " (Contentor na obra)" : ""}
                </small>
              </div>
            </div>
          ),
        },
        ...(!compact
          ? [
              {
                label: "Local",
                render: (w: Work) => <span>{w.local ?? "Por confirmar"}</span>,
              },
            ]
          : []),
        {
          label: "Valor orçamentado",
          render: (w) => isSecretariado ? "—" : money(workFinancials(state, w.id, ledger).budget),
          align: "right",
        },
        {
          label: "Custo atual",
          render: (w) => (
            <b>{money(workFinancials(state, w.id, ledger).cost)}</b>
          ),
          align: "right",
        },
        {
          label: "Custo máximo",
          render: (w) => isSecretariado ? "—" : money(workFinancials(state, w.id, ledger).max),
          align: "right",
        },
        {
          label: "Consumo",
          render: (w) => (
            <div className="cell-progress">
              <span>
                {num(workFinancials(state, w.id, ledger).consumption * 100, 0)}%
              </span>
              <Progress
                value={workFinancials(state, w.id, ledger).consumption}
              />
            </div>
          ),
        },
        {
          label: "Margem atual",
          render: (w) =>
            isSecretariado
              ? "—"
              : `${num(workFinancials(state, w.id, ledger).margin * 100, 1)}%`,
          align: "right",
        },
        {
          label: "Estado / Risco",
          render: (w) => (
            <div>
              <Badge tone={w.estado === "Concluída" ? "green" : w.estado === "Suspensa" ? "amber" : "blue"}>
                {w.estado}
              </Badge>
              {!compact && (
                <small className="block muted">
                  {w.estado === "Concluída" ? "Concluída" : workFinancials(state, w.id, ledger).risk}
                </small>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
export function Works() {
  const { state, ledger, profile } = useStore();
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [creating, setCreating] = useState(false);
  const rows = state.works.filter(
    (w) =>
      includes(`${w.numero} ${w.nome} ${w.local}`, q) &&
      (!risk || workFinancials(state, w.id, ledger).risk === risk) &&
      (!status || w.estado === status) &&
      (!client || w.cliente === client),
  );
  return (
    <>
      <PageHeader
        eyebrow="OPERAÇÃO"
        title="Obras"
        description="Toda a operação, uma obra de cada vez."
        actions={
          <>
            <Badge tone="neutral">{state.works.length} obras no cenário</Badge>
            {profile !== "Gerência" && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Nova obra
              </Button>
            )}
          </>
        }
      />
      <div className="summary-strip">
        <span>
          <i className="status-dot" />
          {state.works.filter((w) => w.estado === "Em curso").length} em curso
        </span>
        <span>
          <CheckCircle2 size={15} style={{ color: "#2e7d32" }} />
          {state.works.filter((w) => w.estado === "Concluída").length} concluídas
        </span>
        <span>
          <TriangleAlert size={15} />
          {
            state.works.filter(
              (w) => w.estado !== "Concluída" && workFinancials(state, w.id, ledger).risk === "Em risco",
            ).length
          }{" "}
          em risco
        </span>
        <span>Sincronizado com Supabase</span>
      </div>
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar por número, obra ou local…"
        />
        <Select
          label="Estado da obra"
          value={status}
          onChange={setStatus}
          placeholder="Todos os estados"
          options={[...new Set(state.works.map((w) => w.estado))]}
        />
        <Select
          label="Cliente"
          value={client}
          onChange={setClient}
          placeholder="Todos os clientes"
          options={[...new Set(state.works.map((w) => w.cliente))]}
        />
        <Select
          label="Risco"
          value={risk}
          onChange={setRisk}
          placeholder="Todos os riscos"
          options={["Saudável", "Atenção", "Em risco", "Orçamento ultrapassado"]}
        />
      </div>
      <WorkTable rows={rows} />
      <p className="footnote">
        Orçamentos e estados são demonstrativos. Margem calculada
        sobre os custos já registados.
      </p>
      {creating && <WorkForm onClose={() => setCreating(false)} />}
    </>
  );
}

export function ContainerMovementModal({
  work,
  initialMode = "consume",
  initialArticleId = "",
  onClose,
}: {
  work: Work;
  initialMode?: "transfer" | "consume" | "return";
  initialArticleId?: string;
  onClose: () => void;
}) {
  const { state, setState, profile, authUser, notify } = useStore();
  const [mode, setMode] = useState<"transfer" | "consume" | "return">(initialMode);
  const [articleId, setArticleId] = useState(initialArticleId);
  const [quantity, setQuantity] = useState(1);
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const containerItemsList = containerArticles(state, work.id);
  const canCentral = canManageCentralWarehouse(profile, authUser);
  const canContainer = canManageWorkContainer(work, profile, authUser);

  const availableArticles =
    mode === "transfer"
      ? state.articles.filter((a) => stock(state, a.id) > 0)
      : containerItemsList.map((ci) => ci.article);

  const selectedArticle = state.articles.find((a) => a.id === articleId);
  const maxAvailable =
    mode === "transfer"
      ? (selectedArticle ? stock(state, selectedArticle.id) : 0)
      : (selectedArticle ? containerStock(state, work.id, selectedArticle.id) : 0);

  const unitRate =
    selectedArticle
      ? (state.settings.valoresInternos[selectedArticle.id] ?? selectedArticle.precoUnitario)
      : 0;

  async function handleSave() {
    if (!selectedArticle) {
      setError("Selecione um artigo.");
      return;
    }
    if (quantity <= 0 || quantity > maxAvailable) {
      setError(`Indique uma quantidade valida (maximo ${maxAvailable}).`);
      return;
    }
    if (mode === "transfer" && !canCentral) {
      setError("Apenas a equipa da ferramentaria/armazem central ou administradores podem autorizar saidas do armazem central.");
      return;
    }
    if (mode === "consume" && !canContainer) {
      setError(`Apenas o responsavel pelo contentor (${work.quemPodeMovimentar || "administracao"}) pode registar consumos deste contentor.`);
      return;
    }

    setSaving(true);
    setError("");

    const movementType =
      mode === "transfer"
        ? ("Transferência Contentor" as const)
        : mode === "consume"
          ? ("Consumo Contentor" as const)
          : ("Retorno Contentor" as const);

    const mov: Movement = {
      id: uid("mov"),
      tipo: movementType,
      artigoId: selectedArticle.id,
      obraId: work.id,
      descricao: `${selectedArticle.descricao} - ${selectedArticle.codigoACRS}`,
      quantidade: quantity,
      valorUnitario: unitRate,
      data: effectiveDate,
      registadoEm: new Date().toISOString(),
      utilizador: authUser?.nome || profile || "Utilizador",
      source: "demo",
    };

    try {
      const nextState = applyMovement(state, mov);
      await persistMovementToSupabase(mov, profile);
      setState(nextState);
      notify(
        mode === "transfer"
          ? "Material transferido para o contentor da obra. Custo mantido pendente (sem encargo imediato)."
          : mode === "consume"
            ? "Consumo do contentor registado com sucesso. Custo de materiais imputado a obra."
            : "Material devolvido do contentor ao armazem central.",
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao registar movimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        mode === "transfer"
          ? "Transferir para Contentor"
          : mode === "consume"
            ? "Registar Consumo em Obra"
            : "Devolver ao Armazem Central"
      }
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="choice-row">
          <button
            type="button"
            className={mode === "consume" ? "active" : ""}
            onClick={() => {
              setMode("consume");
              setArticleId("");
              setQuantity(1);
            }}
          >
            Consumo em Obra
          </button>
          <button
            type="button"
            className={mode === "transfer" ? "active" : ""}
            onClick={() => {
              setMode("transfer");
              setArticleId("");
              setQuantity(1);
            }}
          >
            Entrada no Contentor
          </button>
          <button
            type="button"
            className={mode === "return" ? "active" : ""}
            onClick={() => {
              setMode("return");
              setArticleId("");
              setQuantity(1);
            }}
          >
            Devolucao ao Armazem
          </button>
        </div>

        <Note tone={mode === "consume" ? "amber" : "neutral"}>
          {mode === "transfer"
            ? "Transferencia do armazem central para o contentor da obra. O material fica indisponivel no armazem principal, mas NAO tem custo alocado a obra neste momento."
            : mode === "consume"
              ? "Saida do contentor para aplicacao na obra. O custo de material sera imediatamente imputado a obra."
              : "Retorno do material do contentor de volta ao stock do armazem central."}
        </Note>

        <Field label="Artigo">
          <select
            value={articleId}
            onChange={(e) => {
              setArticleId(e.target.value);
              setQuantity(1);
            }}
          >
            <option value="">Selecionar artigo...</option>
            {availableArticles.map((a) => {
              const qtyAvail =
                mode === "transfer"
                  ? stock(state, a.id)
                  : containerStock(state, work.id, a.id);
              return (
                <option key={a.id} value={a.id}>
                  {a.codigoACRS} - {a.descricao} ({qty(qtyAvail, a)} disponiveis)
                </option>
              );
            })}
          </select>
        </Field>

        {selectedArticle && (
          <div className="form-grid">
            <Field label={`Quantidade (${selectedArticle.unidade ?? "un."})`}>
              <input
                type="number"
                min={selectedArticle.precisao === 0 ? "1" : "0.001"}
                max={maxAvailable}
                step={selectedArticle.precisao === 0 ? "1" : "0.01"}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </Field>
            <Field label="Data efetiva">
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </Field>
          </div>
        )}

        {selectedArticle && (
          <DetailList
            items={[
              ["Stock disponivel", qty(maxAvailable, selectedArticle)],
              ["Preco unitario", money(unitRate)],
              [
                mode === "consume" ? "Custo a imputar a obra" : "Valor do material",
                money(quantity * unitRate),
              ],
              [
                "Responsavel pelo contentor",
                work.quemPodeMovimentar || "Encarregado da obra",
              ],
            ]}
          />
        )}

        {error && <Note tone="red">{error}</Note>}

        <div className="form-actions">
          <Button secondary onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedArticle || quantity <= 0 || quantity > maxAvailable}
          >
            {saving ? "A guardar..." : mode === "consume" ? "Confirmar Consumo" : "Confirmar Movimento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function WorkDetail({ id }: { id: string }) {
  const { state, setState, ledger, profile, authUser, notify } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState("Resumo");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Cost | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [q, setQ] = useState("");
  const [editingWork, setEditingWork] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [closingReportOpen, setClosingReportOpen] = useState(false);
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [containerModalMode, setContainerModalMode] = useState<"transfer" | "consume" | "return">("consume");
  const [containerModalArticle, setContainerModalArticle] = useState("");
  const work = state.works.find((w) => w.id === id);
  if (!work)
    return (
      <PageHeader
        title="Obra não encontrada"
        actions={
          <Button onClick={() => router.push("/obras")}>Ver obras</Button>
        }
      />
    );
  const f = workFinancials(state, id, ledger);
  const costs = ledger.filter((c) => c.obraId === id);
  const timeRows = state.times.filter((t) => t.obraId === id);
  const people = state.people.filter((p) =>
    timeRows.some((t) => t.pessoaId === p.id),
  );
  const invoices = state.invoices.filter((i) => i.obraId === id);
  const allocations = state.allocations.filter((a) => a.obraId === id);
  const budget = state.budgets.find((b) => b.obraId === id);
  const materials = state.movements.filter(
    (m) => m.obraId === id && m.tipo !== "Entrada",
  );
  return (
    <>
      <button className="back-link" onClick={() => router.push("/obras")}>
        <ArrowLeft size={16} /> Todas as obras
      </button>
      <PageHeader
        eyebrow={`OBRA ${work.numero}`}
        title={work.nome}
        description={
          <span className="inline-meta">
            <MapPin size={14} />
            {work.local}
            <span> - </span>{work.cliente}
            {work.contentorEmObra && (
              <>
                <span> - </span>
                <Badge tone="blue">Contentor na obra</Badge>
              </>
            )}
            {work.quemPodeMovimentar && (
              <>
                <span> - </span>
                <span>Movimento autorizado: {work.quemPodeMovimentar}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <Badge tone={work.estado === "Concluída" ? "green" : work.estado === "Suspensa" ? "amber" : "blue"}>
              {work.estado}
            </Badge>
            <Button
              secondary
              onClick={() => setClosingReportOpen(true)}
            >
              <FileText size={15} /> Relatório de fecho
            </Button>
            {profile !== "Gerência" && (
              <>
                {work.estado !== "Concluída" ? (
                  <Button
                    secondary
                    onClick={async () => {
                      try {
                        const updated: Work = {
                          ...work,
                          estado: "Concluída",
                          dataFim: work.dataFim || today(),
                        };
                        await persistWorkToSupabase(updated, profile);
                        setState({
                          ...state,
                          works: state.works.map((w) => (w.id === work.id ? updated : w)),
                        });
                        notify("Obra concluída com sucesso.");
                      } catch (e: any) {
                        notify(`Erro ao concluir obra: ${e.message || e}`);
                      }
                    }}
                  >
                    <CheckCircle2 size={15} /> Concluir obra
                  </Button>
                ) : (
                  <Button
                    secondary
                    onClick={async () => {
                      try {
                        const updated: Work = {
                          ...work,
                          estado: "Em curso",
                          dataFim: null,
                        };
                        await persistWorkToSupabase(updated, profile);
                        setState({
                          ...state,
                          works: state.works.map((w) => (w.id === work.id ? updated : w)),
                        });
                        notify("Obra reaberta para execução.");
                      } catch (e: any) {
                        notify(`Erro ao reabrir obra: ${e.message || e}`);
                      }
                    }}
                  >
                    <RotateCcw size={15} /> Reabrir obra
                  </Button>
                )}
                <Button secondary onClick={() => setEditingWork(true)}>
                  <Pencil size={15} /> Editar obra
                </Button>
                <Button secondary onClick={() => setEditingBudget(true)}>
                  <Calculator size={15} /> Orçamento
                </Button>
                <Button secondary onClick={() => router.push("/armazem/tablet")}>
                  Registar movimento <ArrowUpRight size={16} />
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="metrics six">
        <Metric
          label="Valor orçamentado"
          value={money(f.budget)}
          hint={f.extraBudget && f.extraBudget > 0 ? `Base: ${money(f.baseBudget)} + Extra: ${money(f.extraBudget)}` : "Valor comercial da obra"}
        />
        <Metric
          label="Margem alvo"
          value={`${num(f.target * 100)}%`}
          hint="Objetivo da obra"
        />
        <Metric
          label="Custo máximo"
          value={money(f.max)}
          hint="Limite para a margem alvo"
        />
        <Metric
          label="Custo atual"
          value={money(f.cost)}
          hint={`${costs.length} registos de origem`}
          accent="orange"
          onClick={() => setTab("Custos")}
        />
        <Metric
          label="Disponível"
          value={money(f.available)}
          hint="Até ao custo máximo"
          accent={f.available < 0 ? "danger" : "positive"}
        />
        <Metric
          label="Margem atual"
          value={`${num(f.margin * 100)}%`}
          hint="Sobre custos registados"
        />
      </div>
      <div className="work-consumption">
        <div>
          <Badge>{f.risk}</Badge>
          <span>
            <b>{num(f.consumption * 100, 0)}%</b> do custo máximo utilizado
          </span>
        </div>
        <Progress value={f.consumption} />
        <span>
          {money(f.cost)} de {money(f.max)}
        </span>
      </div>
      <Tabs
        items={[
          "Resumo",
          "Custos",
          "Pessoas",
          "Materiais",
          "Equipamentos",
          "Faturas",
          ...(work.contentorEmObra ? ["Contentor"] : []),
          "Valor orçamentado",
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setCategory("");
          setQ("");
        }}
      />
      {tab === "Resumo" && (
        <>
          <div className="grid-two">
            <Panel
              title="Distribuição de custos"
              subtitle="Do total ao registo que lhe deu origem"
            >
              <CostBreakdown
                costs={costs}
                onCategory={(c) => {
                  setCategory(c);
                  setTab("Custos");
                }}
              />
            </Panel>
            <Panel
              title="Acompanhamento da obra"
              subtitle="Valor orçamentado e execução"
            >
              <div className="panel-body">
                <div className="budget-chart">
                  <div>
                    <span>Custo máximo</span>
                    <div>
                      <i style={{ width: "100%", background: "#e9ecef" }} />
                    </div>
                    <b>{money(f.max)}</b>
                  </div>
                  <div>
                    <span>Custo atual</span>
                    <div>
                      <i
                        className={consumptionTone(f.consumption)}
                        style={{
                          width: `${Math.min(100, f.consumption * 100)}%`,
                        }}
                      />
                    </div>
                    <b>{money(f.cost)}</b>
                  </div>
                  <div>
                    <span>Disponível</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(0, Math.min(100, (1 - f.consumption) * 100))}%`,
                          background: "#598c70",
                        }}
                      />
                    </div>
                    <b>{money(f.available)}</b>
                  </div>
                </div>
                <Note tone={f.risk === "Saudável" ? "neutral" : f.risk === "Orçamento ultrapassado" ? "red" : "amber"}>
                  {f.risk === "Saudável"
                    ? "A obra mantém disponibilidade face ao limite definido."
                    : f.risk === "Orçamento ultrapassado"
                      ? "Esta obra ultrapassou o custo máximo. Consulte os custos e reveja os encargos assumidos."
                      : f.risk === "Em risco"
                        ? "Esta obra aproxima-se do custo máximo. Consulte os custos antes de assumir novos encargos."
                        : "Esta obra entrou na zona de atenção. Acompanhe a evolução dos custos."}
                </Note>
                <div className="mini-facts">
                  <div>
                    <b>{people.length}</b>
                    <span>Pessoas com registo</span>
                  </div>
                  <div>
                    <b>{num(sum(timeRows, (t) => t.horas))} h</b>
                    <span>Horas de trabalho</span>
                  </div>
                  <div>
                    <b>{allocations.filter((a) => !a.devolucao).length}</b>
                    <span>Equipamentos em obra</span>
                  </div>
                  <div>
                    <b>{work.contentorEmObra ? "Sim" : "Nao"}</b>
                    <span>Contentor na obra</span>
                  </div>
                </div>
                {work.contentorEmObra && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "12px 14px",
                      background: "#eff6ff",
                      borderRadius: "6px",
                      border: "1px solid #bfdbfe",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <b style={{ color: "#1e40af" }}>Contentor em Obra</b>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#1d4ed8" }}>
                        {containerArticles(state, id).length} referências em stock ({money(sum(containerArticles(state, id), (ci) => ci.valorTotal))} pendente de consumo)
                      </p>
                    </div>
                    <Button secondary onClick={() => setTab("Contentor")}>
                      Ver contentor <ArrowUpRight size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          </div>
          <Panel
            title="Últimos registos"
            actions={
              <button className="text-button" onClick={() => setTab("Custos")}>
                Ver todos <ArrowUpRight size={15} />
              </button>
            }
          >
            <CostTable rows={costs.slice(0, 5)} onSelect={setSelected} />
          </Panel>
        </>
      )}
      {tab === "Custos" && (
        <>
          <div className="filter-bar">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Pesquisar descrição ou origem…"
            />
            <Select
              label="Categoria de custo"
              value={category}
              onChange={setCategory}
              placeholder="Todas as categorias"
              options={[...new Set(costs.map((c) => c.categoria))]}
            />
            <span className="filter-total">
              Total:{" "}
              <b>
                {money(
                  sum(
                    costs.filter(
                      (c) =>
                        (!category || c.categoria === category) &&
                        includes(`${c.descricao} ${c.origem}`, q),
                    ),
                    (c) => c.valor,
                  ),
                )}
              </b>
            </span>
          </div>
          <CostTable
            rows={costs.filter(
              (c) =>
                (!category || c.categoria === category) &&
                includes(`${c.descricao} ${c.origem}`, q),
            )}
            onSelect={setSelected}
          />
        </>
      )}
      {tab === "Pessoas" && (
        <Table
          rows={people}
          onRow={(p) => {
            setQ(p.nome);
            setTab("Custos");
            setCategory("Mão de obra");
          }}
          columns={[
            { label: "Nome", render: (p) => <b>{p.nome}</b> },
            {
              label: "Empresa",
              render: (p) => (
                <span>
                  {state.companies.find(
                    (company) => company.id === p.empresaId,
                  )?.nome ?? "Por confirmar"}
                </span>
              ),
            },
            {
              label: "Horas normais",
              render: (p) =>
                num(
                  sum(
                    timeRows.filter((t) => t.pessoaId === p.id),
                    (t) =>
                      timeCost(
                        t,
                        p.custoHora ?? 0,
                        effectivePolicy(state, p.id),
                        sum(
                          state.times.filter(
                            (x) => x.pessoaId === p.id && x.data === t.data,
                          ),
                          (x) => x.horas,
                        ),
                      ).normal,
                  ),
                ),
              align: "right",
            },
            {
              label: "Extra",
              render: (p) =>
                num(
                  sum(
                    timeRows.filter((t) => t.pessoaId === p.id),
                    (t) =>
                      timeCost(
                        t,
                        p.custoHora ?? 0,
                        effectivePolicy(state, p.id),
                        sum(
                          state.times.filter(
                            (x) => x.pessoaId === p.id && x.data === t.data,
                          ),
                          (x) => x.horas,
                        ),
                      ).extra,
                  ),
                ),
              align: "right",
            },
            {
              label: "Noturno",
              render: (p) =>
                num(
                  sum(
                    timeRows.filter((t) => t.pessoaId === p.id),
                    (t) => t.horasNoturnas,
                  ),
                ),
              align: "right",
            },
            {
              label: "Viagem",
              render: (p) =>
                num(
                  sum(
                    timeRows.filter((t) => t.pessoaId === p.id),
                    (t) => t.horasViagem,
                  ),
                ),
              align: "right",
            },
            {
              label: "Custo estimado",
              render: (p) =>
                money(
                  sum(
                    costs.filter((c) => c.pessoaId === p.id),
                    (c) => c.valor,
                  ),
                ),
              align: "right",
            },
          ]}
        />
      )}
      {tab === "Materiais" && (
        <Table
          rows={materials}
          onRow={(m) =>
            setSelected(costs.find((c) => c.origemId === m.id) ?? null)
          }
          columns={[
            {
              label: "Código / Descrição",
              render: (m) => (
                <div>
                  <b>
                    {state.articles.find((a) => a.id === m.artigoId)
                      ?.codigoACRS ?? "Outro"}
                  </b>
                  <small className="block muted">{m.descricao}</small>
                </div>
              ),
            },
            {
              label: "Família",
              render: (m) =>
                state.articles.find((a) => a.id === m.artigoId)?.familia ??
                "Extraordinário",
            },
            {
              label: "Quantidade",
              render: (m) =>
                `${m.tipo === "Devolução" ? "-" : ""}${qty(
                  m.quantidade,
                  state.articles.find((a) => a.id === m.artigoId),
                )}`,
              align: "right",
            },
            {
              label: "Valor interno",
              render: (m) => money(m.valorUnitario),
              align: "right",
            },
            {
              label: "Custo na obra",
              render: (m) =>
                m.tipo === "Transferência Contentor" || m.tipo === "Retorno Contentor"
                  ? "0,00 € (Pendente no contentor)"
                  : money(
                      m.quantidade *
                        m.valorUnitario *
                        (m.tipo === "Devolução" ? -1 : 1),
                    ),
              align: "right",
            },
            { label: "Data", render: (m) => date(m.data) },
            {
              label: "Origem",
              render: (m) => (
                <Badge
                  tone={
                    m.tipo === "Consumo Contentor"
                      ? "green"
                      : m.tipo === "Transferência Contentor"
                        ? "blue"
                        : m.tipo === "Devolução"
                          ? "amber"
                          : "neutral"
                  }
                >
                  {m.tipo}
                </Badge>
              ),
            },
          ]}
        />
      )}
      {tab === "Equipamentos" && (
        <Table
          rows={allocations}
          onRow={(a) =>
            setSelected(costs.find((c) => c.origemId === a.id) ?? null)
          }
          columns={[
            {
              label: "Equipamento",
              render: (a) => (
                <div>
                  <b>
                    {state.machines.find((m) => m.id === a.maquinaId)?.nome}
                  </b>
                  <small className="block muted">
                    {state.machines.find((m) => m.id === a.maquinaId)?.numero}
                  </small>
                </div>
              ),
            },
            { label: "Saída", render: (a) => date(a.saida) },
            {
              label: "Devolução",
              render: (a) => (a.devolucao ? date(a.devolucao) : "—"),
            },
            { label: "Dias", render: (a) => days(a), align: "right" },
            {
              label: "€/dia",
              render: (a) => money(a.custoDia),
              align: "right",
            },
            {
              label: "Custo",
              render: (a) => money(days(a) * a.custoDia),
              align: "right",
            },
            {
              label: "Estado",
              render: (a) => (
                <Badge>{a.devolucao ? "Devolvido" : "Em obra"}</Badge>
              ),
            },
          ]}
        />
      )}
      {tab === "Faturas" && (
        <>
          {invoices.some((i) => i.estado === "Por validar") && (
            <div className="summary-strip" style={{ marginBottom: "12px" }}>
              <span>
                <i className="status-dot warning" />
                <b>{invoices.filter((i) => i.estado === "Por validar").length}</b> fatura(s) por validar nesta obra
              </span>
              <span>Clique na fatura para abrir o detalhe lateral e confirmar o registo.</span>
            </div>
          )}
          <Table
            rows={invoices}
            onRow={(i) => setSelectedInvoice(i)}
            columns={[
              { label: "Data", render: (i) => date(i.data) },
              { label: "Fornecedor", render: (i) => <b>{i.fornecedor}</b> },
              { label: "Nº Fatura", render: (i) => i.numero || "—" },
              {
                label: "Categoria",
                render: (i) => i.categoria ?? "Por confirmar",
              },
              { label: "Valor", render: (i) => money(i.valor), align: "right" },
              { label: "Estado", render: (i) => <Badge>{i.estado}</Badge> },
            ]}
          />
        </>
      )}
      {tab === "Contentor" && work.contentorEmObra && (
        <>
          <div className="summary-strip" style={{ marginBottom: "16px" }}>
            <span>
              <Package size={16} />
              <b>Contentor na Obra {work.numero}</b>
              {work.quemPodeMovimentar && (
                <span> - Responsavel autorizado: <b>{work.quemPodeMovimentar}</b></span>
              )}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                onClick={() => {
                  setContainerModalMode("consume");
                  setContainerModalOpen(true);
                }}
              >
                <Plus size={15} /> Registar consumo em obra
              </Button>
              <Button
                secondary
                onClick={() => {
                  setContainerModalMode("transfer");
                  setContainerModalOpen(true);
                }}
              >
                <ArrowUpRight size={15} /> Transferir do armazem
              </Button>
            </div>
          </div>

          <div className="metrics four">
            <Metric
              label="Artigos em stock"
              value={containerArticles(state, id).length}
              hint="Referencias no contentor"
            />
            <Metric
              label="Valor em transito"
              value={money(sum(containerArticles(state, id), (ci) => ci.valorTotal))}
              hint="Sem custo imputado a obra"
            />
            <Metric
              label="Consumos efetuados"
              value={
                state.movements.filter(
                  (m) => m.obraId === id && m.tipo === "Consumo Contentor",
                ).length
              }
              hint="Saidas para a obra"
            />
            <Metric
              label="Custo imputado"
              value={money(
                sum(
                  state.movements.filter(
                    (m) => m.obraId === id && m.tipo === "Consumo Contentor",
                  ),
                  (m) => m.quantidade * m.valorUnitario,
                ),
              )}
              hint="Encargo acumulado da obra"
              accent="orange"
            />
          </div>

          <Panel
            title="Stock atual no contentor"
            subtitle="Materiais fisicamente disponiveis no contentor desta obra"
          >
            {containerArticles(state, id).length === 0 ? (
              <p className="muted" style={{ padding: "16px" }}>
                O contentor nao tem materiais em stock no momento. Transfira artigos do armazem central para carregar o contentor.
              </p>
            ) : (
              <Table
                rows={containerArticles(state, id)}
                columns={[
                  {
                    label: "Artigo",
                    render: (item) => (
                      <div>
                        <b>{item.article.codigoACRS}</b>
                        <small className="block muted">{item.article.descricao}</small>
                      </div>
                    ),
                  },
                  {
                    label: "Familia",
                    render: (item) => item.article.familia,
                  },
                  {
                    label: "Em stock",
                    render: (item) => <b>{qty(item.quantidade, item.article)}</b>,
                    align: "right",
                  },
                  {
                    label: "Preco unit.",
                    render: (item) => money(item.valorUnitario),
                    align: "right",
                  },
                  {
                    label: "Valor total",
                    render: (item) => money(item.valorTotal),
                    align: "right",
                  },
                  {
                    label: "Acoes",
                    render: (item) => (
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <Button
                          secondary
                          onClick={() => {
                            setContainerModalArticle(item.article.id);
                            setContainerModalMode("consume");
                            setContainerModalOpen(true);
                          }}
                        >
                          Consumir
                        </Button>
                        <Button
                          secondary
                          onClick={() => {
                            setContainerModalArticle(item.article.id);
                            setContainerModalMode("return");
                            setContainerModalOpen(true);
                          }}
                        >
                          Devolver
                        </Button>
                      </div>
                    ),
                    align: "right",
                  },
                ]}
              />
            )}
          </Panel>

          <Panel
            title="Historico de movimentos do contentor"
            subtitle="Registo de transferencias do armazem, consumos e retornos"
          >
            <Table
              rows={state.movements.filter(
                (m) =>
                  m.obraId === id &&
                  (m.tipo === "Transferência Contentor" ||
                    m.tipo === "Consumo Contentor" ||
                    m.tipo === "Retorno Contentor"),
              )}
              columns={[
                { label: "Data", render: (m) => date(m.data) },
                {
                  label: "Tipo",
                  render: (m) => (
                    <Badge
                      tone={
                        m.tipo === "Consumo Contentor"
                          ? "green"
                          : m.tipo === "Transferência Contentor"
                            ? "blue"
                            : "amber"
                      }
                    >
                      {m.tipo}
                    </Badge>
                  ),
                },
                {
                  label: "Artigo",
                  render: (m) => m.descricao,
                },
                {
                  label: "Quantidade",
                  render: (m) =>
                    qty(
                      m.quantidade,
                      state.articles.find((a) => a.id === m.artigoId),
                    ),
                  align: "right",
                },
                {
                  label: "Valor unitario",
                  render: (m) => money(m.valorUnitario),
                  align: "right",
                },
                {
                  label: "Impacto no custo da obra",
                  render: (m) => (
                    <b>
                      {m.tipo === "Consumo Contentor"
                        ? `+ ${money(m.quantidade * m.valorUnitario)}`
                        : "0,00 € (Pendente)"}
                    </b>
                  ),
                  align: "right",
                },
                {
                  label: "Registado por",
                  render: (m) => m.utilizador,
                },
              ]}
            />
          </Panel>
        </>
      )}
      {tab === "Valor orçamentado" && (
        <Panel
          title="Valor orçamentado da obra"
          subtitle="Cenário demonstrativo, ajustável em Orçamentos"
          actions={
            <Button secondary onClick={() => setEditingBudget(true)}>
              <Pencil size={15} /> Editar valor orçamentado
            </Button>
          }
        >
          <div className="panel-body">
            <DetailList
              items={[
                ["Valor comercial total", money(f.budget)],
                ...(f.extraBudget && f.extraBudget > 0
                  ? ([
                      ["Valor inicial (base)", money(f.baseBudget)],
                      ["Trabalhos adicionais (extra)", money(f.extraBudget)],
                    ] as [string, React.ReactNode][])
                  : []),
                ["Margem alvo", `${num(f.target * 100)}%`],
                ["Custo maximo", money(f.max)],
                ["Custo atual", money(f.cost)],
                ["Disponivel", money(f.available)],
              ]}
            />
            {budget?.modo === "Discriminado" && (
              <Table
                rows={budget.linhas.map((line) => {
                  const realized = sum(
                    costs.filter(
                      (c) => budgetRubric(c.categoria) === line.categoria,
                    ),
                    (c) => c.valor,
                  );
                  const committed = sum(
                    state.invoices.filter(
                      (i) =>
                        i.obraId === id &&
                        i.estado === "Por validar" &&
                        budgetRubric(i.categoria ?? "Outros") === line.categoria,
                    ),
                    (i) => i.valor,
                  );
                  return { ...line, realized, committed };
                })}
                columns={[
                  { label: "Rubrica", render: (r) => <b>{r.categoria}</b> },
                  { label: "Previsto", render: (r) => money(r.valor), align: "right" },
                  { label: "Realizado", render: (r) => money(r.realized), align: "right" },
                  { label: "Comprometido", render: (r) => money(r.committed), align: "right" },
                  {
                    label: "Disponível",
                    render: (r) => money(r.valor - r.realized - r.committed),
                    align: "right",
                  },
                  {
                    label: "Estado",
                    render: (r) => (
                      <Badge>
                        {r.realized + r.committed > r.valor ? "Em risco" : "Saudável"}
                      </Badge>
                    ),
                  },
                ]}
              />
            )}
            <Progress value={f.consumption} label="Custo máximo utilizado" />
            <Note>
              O orçamento é sincronizado com o Supabase. A margem atual é calculada
              sobre todos os custos já registados.
            </Note>
          </div>
        </Panel>
      )}
      <p className="footnote">
        Mão de obra calculada com política demo. Dados históricos mantidos nas
        datas originais.
      </p>
      {selected && (
        <CostDetail cost={selected} onClose={() => setSelected(null)} />
      )}
      {selectedInvoice && (
        <InvoiceDrawer
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSaved={(saved) => setSelectedInvoice(saved)}
        />
      )}
      {editingWork && (
        <WorkForm work={work} onClose={() => setEditingWork(false)} />
      )}
      {editingBudget && (
        <BudgetForm
          budget={
            budget ?? {
              obraId: work.id,
              valor: 15000,
              valorExtra: 0,
              margem: 0.20,
              modo: "Simples",
              linhas: [],
              source: "ACRS",
            }
          }
          onClose={() => setEditingBudget(false)}
        />
      )}
      {containerModalOpen && (
        <ContainerMovementModal
          work={work}
          initialMode={containerModalMode}
          initialArticleId={containerModalArticle}
          onClose={() => {
            setContainerModalOpen(false);
            setContainerModalArticle("");
          }}
        />
      )}
      {closingReportOpen && (
        <WorkClosingReport
          work={work}
          onClose={() => setClosingReportOpen(false)}
        />
      )}
    </>
  );
}

export function WorkClosingReport({
  work,
  onClose,
}: {
  work: Work;
  onClose: () => void;
}) {
  const { state, setState, profile, notify, ledger } = useStore();
  const f = workFinancials(state, work.id, ledger);
  const budget = state.budgets.find((b) => b.obraId === work.id);
  const costs = ledger.filter((c) => c.obraId === work.id);
  const timeRows = state.times.filter((t) => t.obraId === work.id);
  const invoices = state.invoices.filter((i) => i.obraId === work.id);
  const materials = state.movements.filter(
    (m) => m.obraId === work.id && m.tipo !== "Entrada",
  );

  const laborCosts = costs.filter((c) => c.categoria === "Mão de obra");
  const materialCosts = costs.filter((c) => c.categoria === "Materiais");
  const equipmentCosts = costs.filter((c) => c.categoria === "Ferramentaria");
  const invoiceCosts = costs.filter((c) => c.origem === "Fatura");
  const otherCosts = costs.filter(
    (c) =>
      c.categoria !== "Mão de obra" &&
      c.categoria !== "Materiais" &&
      c.categoria !== "Ferramentaria" &&
      c.origem !== "Fatura",
  );

  const baseBudget = budget?.valor ?? 0;
  const extraBudget = budget?.valorExtra ?? 0;
  const totalBudget = baseBudget + extraBudget;
  const totalCost = f.cost;
  const grossMargin = totalBudget - totalCost;
  const grossMarginPct = totalBudget > 0 ? (grossMargin / totalBudget) * 100 : 0;
  const expectedMarginPct = (budget?.margem ?? 0.2) * 100;
  const marginDeviation = grossMarginPct - expectedMarginPct;

  const totalLaborHours = sum(timeRows, (t) => t.horas + (t.horasViagem || 0));
  const totalRegularHours = sum(timeRows, (t) => t.horas);
  const totalOvertimeHours = sum(timeRows, (t) => t.horasExtraExcel || 0);
  const totalNightHours = sum(timeRows, (t) => t.horasNoturnas || 0);
  const totalTravelHours = sum(timeRows, (t) => t.horasViagem || 0);
  const peopleCount = new Set(timeRows.map((t) => t.pessoaId)).size;

  const machineAllocations = state.allocations.filter((a) => a.obraId === work.id);
  const machinesUsed = new Set(machineAllocations.map((a) => a.maquinaId)).size;
  const machineTotalDays = sum(machineAllocations, (a) => days(a));

  const containerItems = containerArticles(state, work.id);
  const containerStockValue = sum(containerItems, (ci) => ci.valorTotal);

  const cleanNumero = (work.numero || "").replace(/[/\\:*?"<>|]/g, "-").trim();
  const cleanNome = (work.nome || "").replace(/[/\\:*?"<>|]/g, "-").trim();
  const workIdentifier = [cleanNumero, cleanNome].filter(Boolean).join(" - ");
  const reportDocTitle = `Relatorio de Fecho - ${workIdentifier || "ACRS"}`;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = reportDocTitle;
    return () => {
      document.title = prevTitle;
    };
  }, [reportDocTitle]);

  const reportRef = useRef<HTMLDivElement>(null);

  function handlePrintPDF() {
    const el = reportRef.current;
    if (!el) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      if (iframe.parentNode) document.body.removeChild(iframe);
      window.print();
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${reportDocTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 15mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.45;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 16px;
    }
    .report-header h2 {
      margin: 2px 0 4px 0;
      font-size: 19px;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .report-header p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
    }
    .report-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
    }
    .report-meta-item {
      font-size: 11px;
    }
    .report-meta-item span {
      display: block;
      color: #64748b;
      font-size: 10px;
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-meta-item strong {
      color: #0f172a;
      font-size: 12px;
    }
    .report-table-wrap {
      width: 100%;
      margin: 14px 0;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .report-table th {
      background: #f1f5f9 !important;
      text-align: left;
      padding: 8px 10px;
      font-weight: 600;
      color: #334155;
      border-bottom: 1px solid #cbd5e1;
      font-size: 11px;
    }
    .report-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .report-table tfoot td {
      font-weight: 700;
      background: #f8fafc !important;
      border-top: 2px solid #0f172a;
    }
    .report-side-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 14px;
    }
    .report-side-card {
      background: #f8fafc;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .report-side-card h4 {
      margin: 0 0 6px 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
    }
    .report-signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 30px;
      padding-top: 12px;
      page-break-inside: avoid;
    }
    .report-sign-box {
      text-align: center;
      font-size: 11px;
      color: #475569;
    }
    .report-sign-line {
      border-bottom: 1px dashed #94a3b8;
      height: 38px;
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  ${el.innerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 250);
  }

  async function handleConcludeWork() {
    try {
      const updated: Work = {
        ...work,
        estado: "Concluída",
        dataFim: work.dataFim || today(),
      };
      await persistWorkToSupabase(updated, profile);
      setState({
        ...state,
        works: state.works.map((w) => (w.id === work.id ? updated : w)),
      });
      notify("Obra concluída e arquivada com sucesso.");
      onClose();
    } catch (e: any) {
      notify(`Erro ao concluir obra: ${e.message || e}`);
    }
  }

  return (
    <Modal title={`Relatório de Fecho - ${work.nome}`} extraWide onClose={onClose}>
      <div className="modal-body">
        <div
          className="hide-on-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Badge tone={work.estado === "Concluída" ? "green" : "blue"}>{work.estado}</Badge>
            <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--muted)" }}>
              Emitido em {date(today())} por {profile}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button onClick={handlePrintPDF}>
              <Printer size={15} /> Exportar PDF / Imprimir
            </Button>
            {work.estado !== "Concluída" && profile !== "Gerência" && (
              <Button secondary onClick={handleConcludeWork}>
                <CheckCircle2 size={15} /> Concluir obra
              </Button>
            )}
            <Button secondary onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <div ref={reportRef} className="print-report-sheet report-sheet">
          <div className="report-header">
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  color: "#64748b",
                  textTransform: "uppercase",
                }}
              >
                ACRS - Gestão de Obras & Manutenção
              </div>
              <h2>Relatório Executivo de Fecho de Obra</h2>
              <p>Análise de rentabilidade, orçamentação e apuramento final de custos reais</p>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#475569" }}>
              <b>{work.numero}</b>
              <div>Data de emissão: {date(today())}</div>
              <div>Responsável: {profile}</div>
            </div>
          </div>

          <div className="report-meta-grid">
            <div className="report-meta-item">
              <span>Obra</span>
              <strong>{work.nome}</strong>
            </div>
            <div className="report-meta-item">
              <span>Cliente</span>
              <strong>{work.cliente || "Por confirmar"}</strong>
            </div>
            <div className="report-meta-item">
              <span>Localização</span>
              <strong>{work.local || "Não especificada"}</strong>
            </div>
            <div className="report-meta-item">
              <span>Período de execução</span>
              <strong>
                {work.dataInicio ? date(work.dataInicio) : "-"} a{" "}
                {work.dataFim
                  ? date(work.dataFim)
                  : work.estado === "Concluída"
                    ? date(today())
                    : "Em curso"}
              </strong>
            </div>
            <div className="report-meta-item">
              <span>Estado da obra</span>
              <strong>{work.estado}</strong>
            </div>
            <div className="report-meta-item">
              <span>Contentor em obra</span>
              <strong>{work.contentorEmObra ? "Ativo no local" : "Sem contentor"}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "14px", margin: "16px 0 8px 0", color: "#0f172a" }}>
            Quadro Financeiro & Rentabilidade
          </h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Rubrica Orçamental</th>
                  <th style={{ textAlign: "right" }}>Valor Previsto</th>
                  <th style={{ textAlign: "right" }}>Custo Real</th>
                  <th style={{ textAlign: "right" }}>Desvio / Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Orçamento Inicial Contratado</td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(baseBudget)}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>-</td>
                  <td style={{ textAlign: "right" }}>-</td>
                </tr>
                {extraBudget > 0 && (
                  <tr>
                    <td>Orçamento Extra / Trabalhos Adicionais</td>
                    <td style={{ textAlign: "right" }}>
                      <b>+{money(extraBudget)}</b>
                    </td>
                    <td style={{ textAlign: "right" }}>-</td>
                    <td style={{ textAlign: "right" }}>-</td>
                  </tr>
                )}
                <tr style={{ background: "#f8fafc", fontWeight: 600 }}>
                  <td>Total Faturado ao Cliente (Receita)</td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(totalBudget)}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>-</td>
                  <td style={{ textAlign: "right" }}>-</td>
                </tr>
                <tr>
                  <td>Custo Total Incorrido na Obra</td>
                  <td style={{ textAlign: "right" }}>{money(f.max)} (teto máx.)</td>
                  <td
                    style={{
                      textAlign: "right",
                      color: totalCost > f.max ? "#dc2626" : "#0f172a",
                    }}
                  >
                    <b>{money(totalCost)}</b>
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: f.available >= 0 ? "#16a34a" : "#dc2626",
                    }}
                  >
                    <b>{money(f.available)}</b>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Margem Bruta Final da Obra</td>
                  <td style={{ textAlign: "right" }}>{num(expectedMarginPct, 1)}% (prevista)</td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(grossMargin)}</b>
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: grossMarginPct >= expectedMarginPct ? "#16a34a" : "#dc2626",
                    }}
                  >
                    <b>{num(grossMarginPct, 1)}%</b> ({marginDeviation >= 0 ? "+" : ""}
                    {num(marginDeviation, 1)} pp)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <h3 style={{ fontSize: "14px", margin: "24px 0 8px 0", color: "#0f172a" }}>
            Decomposição de Custos Reais
          </h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Natureza do Custo</th>
                  <th>Origem dos Registos</th>
                  <th style={{ textAlign: "right" }}>Quantitativo</th>
                  <th style={{ textAlign: "right" }}>Custo Total (€)</th>
                  <th style={{ textAlign: "right" }}>Peso (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Mão de obra</b>
                  </td>
                  <td>Ponto diário e suplementos</td>
                  <td style={{ textAlign: "right" }}>
                    {num(totalLaborHours)} h ({peopleCount} colaboradores)
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(sum(laborCosts, (c) => c.valor))}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {totalCost > 0
                      ? num((sum(laborCosts, (c) => c.valor) / totalCost) * 100, 1)
                      : 0}
                    %
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Materiais e consumíveis</b>
                  </td>
                  <td>Saídas de armazém e consumos de contentor</td>
                  <td style={{ textAlign: "right" }}>{materials.length} movimentos</td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(sum(materialCosts, (c) => c.valor))}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {totalCost > 0
                      ? num((sum(materialCosts, (c) => c.valor) / totalCost) * 100, 1)
                      : 0}
                    %
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Ferramentaria e máquinas</b>
                  </td>
                  <td>Alocação diária de equipamentos</td>
                  <td style={{ textAlign: "right" }}>
                    {machinesUsed} equipamentos ({machineTotalDays} dias)
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(sum(equipmentCosts, (c) => c.valor))}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {totalCost > 0
                      ? num((sum(equipmentCosts, (c) => c.valor) / totalCost) * 100, 1)
                      : 0}
                    %
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Faturas e despesas diretas</b>
                  </td>
                  <td>Compras para a obra validadas</td>
                  <td style={{ textAlign: "right" }}>{invoices.length} faturas</td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(sum(invoiceCosts, (c) => c.valor))}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {totalCost > 0
                      ? num((sum(invoiceCosts, (c) => c.valor) / totalCost) * 100, 1)
                      : 0}
                    %
                  </td>
                </tr>
                {otherCosts.length > 0 && (
                  <tr>
                    <td>
                      <b>Outros encargos / Danos</b>
                    </td>
                    <td>Registos manuais e perdas</td>
                    <td style={{ textAlign: "right" }}>{otherCosts.length} registos</td>
                    <td style={{ textAlign: "right" }}>
                      <b>{money(sum(otherCosts, (c) => c.valor))}</b>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {totalCost > 0
                        ? num((sum(otherCosts, (c) => c.valor) / totalCost) * 100, 1)
                        : 0}
                      %
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <b>Total de Custos Reais</b>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <b>{money(totalCost)}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="report-side-grid">
            <div className="report-side-card">
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "12px",
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Resumo de Mão de Obra
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                <div>
                  Horas normais: <b>{num(totalRegularHours)} h</b>
                </div>
                <div>
                  Horas extra: <b>{num(totalOvertimeHours)} h</b>
                </div>
                <div>
                  Horas noturnas: <b>{num(totalNightHours)} h</b>
                </div>
                <div>
                  Horas de viagem: <b>{num(totalTravelHours)} h</b>
                </div>
              </div>
            </div>

            <div className="report-side-card">
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "12px",
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Situação do Contentor & Devoluções
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                {work.contentorEmObra ? (
                  <>
                    <div>
                      Artigos remanescentes no contentor:{" "}
                      <b>{containerItems.length} referências</b>
                    </div>
                    <div>
                      Valor em trânsito pendente: <b>{money(containerStockValue)}</b>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: containerItems.length > 0 ? "#b45309" : "#16a34a",
                        marginTop: "4px",
                      }}
                    >
                      {containerItems.length > 0
                        ? "Nota: Os artigos no contentor devem ser devolvidos ao armazém central após a conclusão."
                        : "Contentor totalmente desocupado e regularizado."}
                    </div>
                  </>
                ) : (
                  <div>Obra sem contentor alocado. Materiais fornecidos do armazém central.</div>
                )}
              </div>
            </div>
          </div>

          <div className="report-signatures">
            <div className="report-sign-box">
              <div className="report-sign-line" />
              <b>Encarregado de Obra</b>
              <div>{work.quemPodeMovimentar || "Responsável de Campo"}</div>
            </div>
            <div className="report-sign-box">
              <div className="report-sign-line" />
              <b>Armazém & Logística</b>
              <div>Responsável de Ferramentaria</div>
            </div>
            <div className="report-sign-box">
              <div className="report-sign-line" />
              <b>Direção Geral / Administração</b>
              <div>João Catalão / Gerência</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
