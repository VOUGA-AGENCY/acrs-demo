"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  MapPin,
  FileText,
  Euro,
  TriangleAlert,
  Plus,
  Pencil,
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
import { days, effectivePolicy, timeCost, workFinancials } from "@/lib/engine";
import { date, includes, money, num, qty, sum } from "@/lib/format";
import type { Cost, Invoice, Work } from "@/types";
import { persistWorkToSupabase } from "@/lib/supabase/service";
import { InvoiceDrawer } from "./invoices";
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
  const [error, setError] = useState("");
  function save() {
    if (!number.trim() || !name.trim()) {
      setError("Indique o número e o nome da obra.");
      return;
    }
    const exists = state.works.some(
      (w) => w.numero.trim() === number.trim() && w.id !== work?.id,
    );
    if (exists) {
      setError("Já existe uma obra com este número.");
      return;
    }
    const saved: Work = {
      id: work?.id ?? "demo-nova-obra",
      numero: number.trim(),
      nome: name.trim(),
      cliente: client.trim() || "Por confirmar",
      local: location.trim() || null,
      estado: status,
      dataInicio: start || undefined,
      dataFim: end || null,
      source: "demo",
    };
    setState({
      ...state,
      works: work
        ? state.works.map((w) => (w.id === work.id ? saved : w))
        : [...state.works.filter((w) => w.id !== saved.id), saved],
    });
    persistWorkToSupabase(saved, profile).catch(console.error);
    notify(work ? "Obra atualizada." : "Obra criada e persistida na base de dados.");
    onClose();
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
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
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
        </div>
        <Note>Os dados criados ou alterados ficam apenas nesta sessão.</Note>
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
  const { state, ledger } = useStore();
  const router = useRouter();
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
          render: (w) => money(workFinancials(state, w.id, ledger).budget),
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
          render: (w) => money(workFinancials(state, w.id, ledger).max),
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
            `${num(workFinancials(state, w.id, ledger).margin * 100, 1)}%`,
          align: "right",
        },
        {
          label: "Estado / Risco",
          render: (w) => (
            <div>
              <Badge>{workFinancials(state, w.id, ledger).risk}</Badge>
              {!compact && <small className="block muted">{w.estado}</small>}
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
          <TriangleAlert size={15} />
          {
            state.works.filter(
              (w) => workFinancials(state, w.id, ledger).risk === "Em risco",
            ).length
          }{" "}
          em risco
        </span>
        <span>Histórico ACRS + movimentos desta sessão</span>
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
export function WorkDetail({ id }: { id: string }) {
  const { state, ledger, profile } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState("Resumo");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Cost | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [q, setQ] = useState("");
  const [editingWork, setEditingWork] = useState(false);
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
            <span>·</span>{work.cliente}
          </span>
        }
        actions={
          <>
            <Badge>{work.estado}</Badge>
            {profile !== "Gerência" && (
              <>
                <Button secondary onClick={() => setEditingWork(true)}>
                  <Pencil size={15} /> Editar obra
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
          hint="Valor comercial da obra"
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
                </div>
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
              label: "Total",
              render: (m) =>
                money(
                  m.quantidade *
                    m.valorUnitario *
                    (m.tipo === "Devolução" ? -1 : 1),
                ),
              align: "right",
            },
            { label: "Data", render: (m) => date(m.data) },
            { label: "Origem", render: (m) => <Badge>{m.tipo}</Badge> },
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
      {tab === "Valor orçamentado" && (
        <Panel
          title="Valor orçamentado da obra"
          subtitle="Cenário demonstrativo, ajustável em Orçamentos"
          actions={
            <Button secondary onClick={() => router.push("/orcamentos")}>
              Editar valor orçamentado <ArrowUpRight size={15} />
            </Button>
          }
        >
          <div className="panel-body">
            <DetailList
              items={[
                ["Valor comercial", money(f.budget)],
                ["Margem alvo", `${num(f.target * 100)}%`],
                ["Custo máximo", money(f.max)],
                ["Custo atual", money(f.cost)],
                ["Disponível", money(f.available)],
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
              O orçamento não existia integrado no Excel. Estes valores são
              demonstrativos. A margem atual não é uma previsão da margem final.
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
    </>
  );
}
