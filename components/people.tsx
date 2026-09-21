"use client";
import { useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  Factory,
  Check,
} from "lucide-react";
import { useStore } from "./store";
import { effectivePolicy, timeCost, validateTimeEntry } from "@/lib/engine";
import { date, includes, money, num, sum, today, uid } from "@/lib/format";
import type { Company, Cost, Person, TimeEntry } from "@/types/index";
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
  Select,
  Table,
  Tabs,
} from "./ui";
import { CostDetail, CostTable } from "./costs";
import { persistTimeEntryToSupabase } from "@/lib/supabase/service";
const addDays = (d: string, n: number) => {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const monday = (d: string) => {
  const day = new Date(d + "T12:00:00Z").getUTCDay();
  return addDays(d, -((day + 6) % 7));
};
function duration(start: string | null, end: string | null) {
  if (!start || !end || start === end) return 0;
  const [a, b] = start.split(":").map(Number);
  const [c, d] = end.split(":").map(Number);
  return ((c * 60 + d - a * 60 - b + 1440) % 1440) / 60;
}
function night(start: string | null, end: string | null) {
  if (!start || !end || start === end) return 0;
  const [a, b] = start.split(":").map(Number);
  const lo = a * 60 + b;
  const hi = lo + duration(start, end) * 60;
  let n = 0;
  for (let t = lo; t < hi; t++) if (t % 1440 < 420 || t % 1440 >= 1320) n++;
  return n / 60;
}
export function TimeEditor({
  person,
  day,
  entries,
  onClose,
}: {
  person: Person;
  day: string;
  entries: TimeEntry[];
  onClose: () => void;
}) {
  const { state, setState, profile, notify } = useStore();
  const blank: TimeEntry = {
    id: uid("ponto"),
    pessoaId: person.id,
    nome: person.nome,
    data: day,
    obraId: "",
    local: "",
    entradaManha: "08:00",
    saidaManha: "12:00",
    entradaTarde: "13:00",
    saidaTarde: "17:00",
    entradaNoite: null,
    saidaNoite: null,
    tempoViagem: "00:00",
    horas: 8,
    horasViagem: 0,
    horasNoturnas: 0,
    horasExtraExcel: 0,
    source: "demo",
  };
  const [entry, setEntry] = useState<TimeEntry>(entries[0] ?? blank);
  const [error, setError] = useState("");
  const fields = [
    "entradaManha",
    "saidaManha",
    "entradaTarde",
    "saidaTarde",
    "entradaNoite",
    "saidaNoite",
  ] as const;
  const labels = [
    "Entrada manhã",
    "Saída manhã",
    "Entrada tarde",
    "Saída tarde",
    "Entrada noite",
    "Saída noite",
  ];
  const hours =
    duration(entry.entradaManha, entry.saidaManha) +
    duration(entry.entradaTarde, entry.saidaTarde) +
    duration(entry.entradaNoite, entry.saidaNoite);
  const nightHours =
    night(entry.entradaManha, entry.saidaManha) +
    night(entry.entradaTarde, entry.saidaTarde) +
    night(entry.entradaNoite, entry.saidaNoite);
  const travel = (entry.tempoViagem ?? "00:00").split(":").map(Number);
  const prepared = {
    ...entry,
    horas: hours,
    horasViagem: (travel[0] || 0) + (travel[1] || 0) / 60,
    horasNoturnas: nightHours,
  };
  const otherDailyHours = sum(
    state.times.filter(
      (t) =>
        t.pessoaId === person.id &&
        t.data === entry.data &&
        t.id !== entry.id,
    ),
    (t) => t.horas,
  );
  const dailyHours = otherDailyHours + hours;
  const company = state.companies.find((item) => item.id === person.empresaId);
  const appliedPolicy = effectivePolicy(state, person.id);
  const calculated = timeCost(
    prepared,
    person.custoHora ?? 0,
    appliedPolicy,
    dailyHours,
    sum(
      state.times.filter(
        (t) =>
          t.pessoaId === person.id &&
          t.data === entry.data &&
          t.id !== entry.id,
      ),
      (t) => t.horasNoturnas,
    ) + nightHours,
    state.settings.holidays.includes(entry.data),
  );
  async function save() {
    if (!entry.obraId || !entry.data) {
      setError("Selecione a obra e a data.");
      return;
    }
    if (
      fields.some(
        (f, i) =>
          i % 2 === 0 && Boolean(entry[f]) !== Boolean(entry[fields[i + 1]]),
      )
    ) {
      setError("Preencha a entrada e a saída de cada período utilizado.");
      return;
    }
    if (hours <= 0 || hours > 24) {
      setError("O total diário deve ficar entre 0 e 24 horas.");
      return;
    }
    try {
      validateTimeEntry(state, prepared);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const edited = {
      ...prepared,
      utilizador: profile,
      source: "demo" as const,
      registadoEm: new Date().toISOString(),
    };
    try {
      await persistTimeEntryToSupabase(edited, profile);
    } catch (e) {
      setError(`Não foi possível guardar o ponto na base de dados: ${(e as Error).message}`);
      return;
    }
    setState({
      ...state,
      times: state.times.some((t) => t.id === entry.id)
        ? state.times.map((t) => (t.id === entry.id ? edited : t))
        : [edited, ...state.times],
    });
    notify("Ponto registado. Custo da obra atualizado.");
    onClose();
  }
  return (
    <Modal title="Registo de ponto" onClose={onClose}>
      <div className="modal-body">
        {entries.length > 1 && (
          <Field label="Registo deste dia">
            <Select
              label="Registo de ponto"
              value={entry.id}
              onChange={(id) => setEntry(entries.find((t) => t.id === id)!)}
              options={entries.map((t) => ({
                value: t.id,
                label: `Obra ${t.obraId} · ${num(t.horas)} h`,
              }))}
            />
          </Field>
        )}
        <div className="person-heading">
          <span className="avatar">
            {person.nome
              .split(" ")
              .slice(0, 2)
              .map((x) => x[0])
              .join("")}
          </span>
          <div>
            <b>{person.nome}</b>
            <small>
              {company?.nome ?? "Empresa por confirmar"} ·{" "}
              {person.custoHora != null
                ? `${money(person.custoHora)}/h`
                : "Tarifa por apurar"}
            </small>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Data">
            <input
              type="date"
              value={entry.data}
              onChange={(e) => setEntry({ ...entry, data: e.target.value })}
            />
          </Field>
          <Field label="Obra">
            <WorkSelector
              value={entry.obraId}
              onChange={(v) =>
                setEntry({
                  ...entry,
                  obraId: v,
                  local: state.works.find((w) => w.id === v)?.local ?? "",
                })
              }
            />
          </Field>
        </div>
        <Field label="Local">
          <input
            value={entry.local ?? ""}
            onChange={(e) => setEntry({ ...entry, local: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          {fields.map((f, i) => (
            <Field key={f} label={labels[i]}>
              <input
                type="time"
                value={entry[f] ?? ""}
                onChange={(e) =>
                  setEntry({ ...entry, [f]: e.target.value || null })
                }
              />
            </Field>
          ))}
        </div>
        <Field label="Tempo de viagem">
          <input
            type="time"
            value={entry.tempoViagem ?? "00:00"}
            onChange={(e) =>
              setEntry({ ...entry, tempoViagem: e.target.value })
            }
          />
        </Field>
        <div className="time-summary">
          <span>
            Trabalho <b>{num(hours)} h</b>
          </span>
          <span>
            Extra atribuída <b>{num(calculated.extra)} h</b>
          </span>
          <span>
            Noturno <b>{num(nightHours)} h</b>
          </span>
          <span>
            Viagem <b>{num(prepared.horasViagem)} h</b>
          </span>
        </div>
        <Note tone="amber">
          Custo estimado: <b>{money(calculated.total)}</b>. Extra a partir da{" "}
          {appliedPolicy.limiteExtra + 1}.ª hora; viagem incluída;{" "}
          {appliedPolicy.acumular
            ? "suplementos acumulados"
            : "maior suplemento aplicável"}
          . {dailyHours > hours && (
            <>Extra repartida por {num(dailyHours)} h trabalhadas neste dia.</>
          )}
        </Note>
        {error && <Note tone="red">{error}</Note>}
        <div className="form-actions">
          <Button secondary onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>
            Guardar ponto <Check size={16} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function Point() {
  const { state } = useStore();
  const [week, setWeek] = useState(() => monday(today()));
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{
    person: Person;
    day: string;
    entries: TimeEntry[];
  } | null>(null);
  const [newPerson, setNewPerson] = useState("");
  const [adding, setAdding] = useState(false);
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const dates = weekdays.map((_, i) => addDays(week, i));
  const periods = state.times.filter((t) => dates.includes(t.data));
  const people = state.people.filter(
    (p) =>
      includes(p.nome, q) &&
      (periods.some((t) => t.pessoaId === p.id) || Boolean(q)),
  );
  return (
    <>
      <PageHeader
        eyebrow="PESSOAS"
        title="Ponto"
        description="Registo administrativo semanal. Selecione um dia para consultar ou editar."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} /> Registar ponto
          </Button>
        }
      />
      <div className="metrics four">
        <Metric
          label="Pessoas no período"
          value={new Set(periods.map((t) => t.pessoaId)).size}
        />
        <Metric
          label="Horas de trabalho"
          value={`${num(sum(periods, (t) => t.horas))} h`}
        />
        <Metric
          label="Horas de viagem"
          value={`${num(sum(periods, (t) => t.horasViagem))} h`}
        />
        <Metric label="Registos" value={periods.length} />
      </div>
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar colaborador…"
        />
        <div className="week-selector">
          <button
            aria-label="Semana anterior"
            onClick={() => setWeek(addDays(week, -7))}
          >
            <ChevronLeft size={18} />
          </button>
          <b>
            {date(week)} — {date(dates[6])}
          </b>
          <button
            aria-label="Semana seguinte"
            onClick={() => setWeek(addDays(week, 7))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <Button secondary onClick={() => setWeek(monday(today()))}>
          Esta semana
        </Button>
      </div>
      <Table
        rows={people}
        pageSize={15}
        columns={[
          {
            label: "Pessoa",
            render: (p) => (
              <div>
                <b>{p.nome}</b>
                <small className="block muted">
                  {state.companies.find(
                    (company) => company.id === p.empresaId,
                  )?.nome ?? "Empresa por confirmar"}
                </small>
              </div>
            ),
          },
          ...dates.map((d, i) => ({
            label: `${weekdays[i]} ${date(d).slice(0, 5)}`,
            render: (p: Person) => {
              const ts = periods.filter(
                (t) => t.pessoaId === p.id && t.data === d,
              );
              return (
                <button
                  className={`time-cell ${ts.length ? "filled" : ""}`}
                  onClick={() =>
                    setSelected({ person: p, day: d, entries: ts })
                  }
                >
                  {ts.length ? `${num(sum(ts, (t) => t.horas))} h` : "+"}
                </button>
              );
            },
          })),
          {
            label: "Total",
            render: (p) => (
              <b>
                {num(
                  sum(
                    periods.filter((t) => t.pessoaId === p.id),
                    (t) => t.horas,
                  ),
                )}{" "}
                h
              </b>
            ),
            align: "right",
          },
        ]}
      />
      <Note>
        Abre na última semana com histórico selecionado. Horas e datas reais;
        custos calculados por uma política demonstrativa. O registo continua a
        ser feito pela administração.
      </Note>
      {selected && (
        <TimeEditor {...selected} onClose={() => setSelected(null)} />
      )}{" "}
      {adding && (
        <Modal title="Novo registo de ponto" onClose={() => setAdding(false)}>
          <div className="modal-body">
            <Field label="Pessoa">
              <Select
                label="Pessoa a registar"
                value={newPerson}
                onChange={setNewPerson}
                placeholder="Selecionar pessoa"
                options={state.people.map((p) => ({
                  value: p.id,
                  label: p.nome,
                }))}
              />
            </Field>
            <Button
              disabled={!newPerson}
              onClick={() => {
                setSelected({
                  person: state.people.find((p) => p.id === newPerson)!,
                  day: today(),
                  entries: [],
                });
                setAdding(false);
              }}
            >
              Continuar <Plus size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function PersonDetail({
  person,
  onClose,
}: {
  person: Person;
  onClose: () => void;
}) {
  const { state, ledger } = useStore();
  const [tab, setTab] = useState("Resumo");
  const [cost, setCost] = useState<Cost | null>(null);
  const times = state.times.filter((t) => t.pessoaId === person.id);
  const costs = ledger.filter((c) => c.pessoaId === person.id);
  const works = state.works.filter((w) => times.some((t) => t.obraId === w.id));
  const company = state.companies.find((item) => item.id === person.empresaId);
  const appliedPolicy = effectivePolicy(state, person.id);
  return (
    <Modal title={person.nome} drawer onClose={onClose}>
      <div className="drawer-body">
        <div className="detail-hero">
          <Badge>
            {times.length ? "Com atividade" : "Sem registos no cenário"}
          </Badge>
          <h3>{person.nome}</h3>
          <p className="muted">
            {company?.nome ?? "Empresa por confirmar"} ·{" "}
            {person.tipo ?? "Vínculo por confirmar"}
          </p>
        </div>
        <Tabs
          items={["Resumo", "Ponto", "Obras", "Custos"]}
          value={tab}
          onChange={setTab}
        />
        {tab === "Resumo" && (
          <>
            <DetailList
              items={[
                [
                  "Custo/hora",
                  person.custoHora != null
                    ? money(person.custoHora)
                    : "Por apurar",
                ],
                ["Horas de trabalho", `${num(sum(times, (t) => t.horas))} h`],
                [
                  "Tempo de viagem",
                  `${num(sum(times, (t) => t.horasViagem))} h`,
                ],
                ["Custo estimado", money(sum(costs, (c) => c.valor))],
                ["Obras", works.length],
                ["Empresa", company?.nome ?? "Por confirmar"],
                [
                  "Hora extra",
                  `A partir da ${appliedPolicy.limiteExtra + 1}.ª hora · +${num(appliedPolicy.extra * 100, 0)}%`,
                ],
              ]}
            />
            <Note>
              A associação pessoa–empresa é demonstrativa e deverá ser
              substituída pela distribuição real fornecida pela ACRS.
            </Note>
          </>
        )}
        {tab === "Ponto" && (
          <Table
            rows={times}
            onRow={(t) =>
              setCost(costs.find((c) => c.origemId === t.id) ?? null)
            }
            columns={[
              { label: "Data", render: (t) => date(t.data) },
              { label: "Obra", render: (t) => t.obraId },
              { label: "Horas", render: (t) => num(t.horas) },
              { label: "Viagem", render: (t) => num(t.horasViagem) },
            ]}
          />
        )}{" "}
        {tab === "Obras" && (
          <Table
            rows={works}
            onRow={(w) => {
              setTab("Custos");
            }}
            columns={[
              {
                label: "Obra",
                render: (w) => (
                  <b>
                    {w.numero} · {w.nome}
                  </b>
                ),
              },
              {
                label: "Horas",
                render: (w) =>
                  num(
                    sum(
                      times.filter((t) => t.obraId === w.id),
                      (t) => t.horas,
                    ),
                  ),
              },
              {
                label: "Custo",
                render: (w) =>
                  money(
                    sum(
                      costs.filter((c) => c.obraId === w.id),
                      (c) => c.valor,
                    ),
                  ),
              },
            ]}
          />
        )}
        {tab === "Custos" && <CostTable rows={costs} onSelect={setCost} />}
      </div>
      {cost && <CostDetail cost={cost} onClose={() => setCost(null)} />}
    </Modal>
  );
}
export function People() {
  const { state, ledger } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("Com atividade");
  const [person, setPerson] = useState<Person | null>(null);
  const active = new Set(state.times.map((t) => t.pessoaId));
  const rows = state.people.filter(
    (p) =>
      includes(p.nome, q) &&
      (!filter ||
        (filter === "Com atividade" ? active.has(p.id) : !active.has(p.id))),
  );
  return (
    <>
      <PageHeader
        eyebrow="PESSOAS"
        title="Colaboradores"
        description="Pessoas, horas e participação nas obras."
      />
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar colaborador…"
        />
        <Select
          label="Atividade"
          value={filter}
          onChange={setFilter}
          placeholder="Todas as pessoas"
          options={["Com atividade", "Sem registos"]}
        />
      </div>
      <Table
        rows={rows}
        onRow={setPerson}
        columns={[
          {
            label: "Nome",
            render: (p) => (
              <div className="person-name">
                <span className="avatar">
                  {p.nome
                    .split(" ")
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")}
                </span>
                <b>{p.nome}</b>
              </div>
            ),
          },
          {
            label: "Empresa / Tipo",
            render: (p) => (
              <span>
                {state.companies.find(
                  (company) => company.id === p.empresaId,
                )?.nome ?? "Por confirmar"}
                <small className="block muted">
                  {p.tipo ?? "Vínculo por confirmar"}
                </small>
              </span>
            ),
          },
          {
            label: "Custo/hora",
            render: (p) =>
              p.custoHora != null ? money(p.custoHora) : "Por apurar",
            align: "right",
          },
          {
            label: "Horas no histórico",
            render: (p) =>
              `${num(
                sum(
                  state.times.filter((t) => t.pessoaId === p.id),
                  (t) => t.horas,
                ),
              )} h`,
            align: "right",
          },
          {
            label: "Custo estimado",
            render: (p) =>
              money(
                sum(
                  ledger.filter((c) => c.pessoaId === p.id),
                  (c) => c.valor,
                ),
              ),
            align: "right",
          },
          {
            label: "Estado",
            render: (p) => (
              <Badge tone={active.has(p.id) ? "green" : "neutral"}>
                {active.has(p.id) ? "Com atividade" : "Sem registos"}
              </Badge>
            ),
          },
        ]}
      />
      <p className="footnote">
        Custo estimado com política demo.
      </p>
      {person && (
        <PersonDetail person={person} onClose={() => setPerson(null)} />
      )}
    </>
  );
}
export function Companies() {
  const { state, ledger } = useStore();
  const [selected, setSelected] = useState<Company | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="PESSOAS"
        title="Empresas"
        description="Trabalhadores internos e empresas subcontratadas."
      />
      <Note tone="amber">
        Empresas e distribuição de trabalhadores criadas para a demo. A ACRS
        deverá confirmar as associações reais antes da migração.
      </Note>
      <div className="company-grid">
        {state.companies.map((company) => {
          const workers = state.people.filter(
            (p) => p.empresaId === company.id,
          );
          const workerIds = new Set(workers.map((p) => p.id));
          const times = state.times.filter((t) => workerIds.has(t.pessoaId));
          const costs = ledger.filter(
            (c) => c.pessoaId && workerIds.has(c.pessoaId),
          );
          return (
            <button
              className="company-card"
              key={company.id}
              onClick={() => setSelected(company)}
            >
              {company.tipo === "Interna" ? (
                <Factory size={25} />
              ) : (
                <Users size={25} />
              )}
              <Badge tone={company.tipo === "Interna" ? "neutral" : "amber"}>
                {company.tipo}
              </Badge>
              <h2>{company.nome}</h2>
              <p>
                {company.tipo === "Interna"
                  ? "Funcionários ACRS"
                  : "Trabalhadores subcontratados"}
              </p>
              <div>
                <span>Trabalhadores</span>
                <b>{workers.length}</b>
              </div>
              <div>
                <span>Horas no histórico</span>
                <b>{num(sum(times, (t) => t.horas))} h</b>
              </div>
              <div>
                <span>Custo estimado</span>
                <b>{money(sum(costs, (c) => c.valor))}</b>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <Modal title={selected.nome} drawer onClose={() => setSelected(null)}>
          <div className="drawer-body">
            {(() => {
              const workers = state.people.filter(
                (p) => p.empresaId === selected.id,
              );
              const workerIds = new Set(workers.map((p) => p.id));
              const times = state.times.filter((t) =>
                workerIds.has(t.pessoaId),
              );
              const costs = ledger.filter(
                (c) => c.pessoaId && workerIds.has(c.pessoaId),
              );
              const companyPolicy =
                selected.tipo === "Interna"
                  ? state.settings.policy
                  : {
                      ...state.settings.policy,
                      ...state.settings.companyPolicies[selected.id],
                    };
              const works = state.works.filter((w) =>
                times.some((t) => t.obraId === w.id),
              );
              return (
                <>
                  <DetailList
                    items={[
                      ["Tipo", selected.tipo],
                      ["Trabalhadores", workers.length],
                      ["Horas", `${num(sum(times, (t) => t.horas))} h`],
                      ["Custo estimado", money(sum(costs, (c) => c.valor))],
                      ["Obras associadas", works.length],
                      [
                        "Hora extra",
                        `A partir da ${companyPolicy.limiteExtra + 1}.ª hora · +${num(companyPolicy.extra * 100, 0)}%`,
                      ],
                    ]}
                  />
                  <h3 className="small-title">Trabalhadores</h3>
                  <Table
                    rows={workers}
                    onRow={setPerson}
                    columns={[
                      { label: "Nome", render: (p) => <b>{p.nome}</b> },
                      { label: "Vínculo", render: (p) => p.tipo ?? "—" },
                      {
                        label: "Custo/hora",
                        render: (p) =>
                          p.custoHora != null ? money(p.custoHora) : "—",
                        align: "right",
                      },
                    ]}
                  />
                  <h3 className="small-title">Obras com registos</h3>
                  {works.map((w) => (
                    <div className="compact-row" key={w.id}>
                      <b>
                        {w.numero} · {w.nome}
                      </b>
                      <span>
                        {num(
                          sum(
                            times.filter((t) => t.obraId === w.id),
                            (t) => t.horas,
                          ),
                        )}{" "}
                        h
                      </span>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </Modal>
      )}
      {person && (
        <PersonDetail person={person} onClose={() => setPerson(null)} />
      )}
    </>
  );
}
