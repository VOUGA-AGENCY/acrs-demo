"use client";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useStore } from "./store";
import { effectivePolicy, stock, workFinancials } from "@/lib/engine";
import { money, num, qty, sum, today } from "@/lib/format";
import type { Cost } from "@/types/index";
import {
  Badge,
  Button,
  Metric,
  Note,
  PageHeader,
  Panel,
  Select,
  Table,
  Tabs,
} from "./ui";
import { CostBreakdown, CostDetail, CostTable } from "./costs";
import { MonthlyChart, Ranking } from "./control-charts";
export function Control({ initialTab = "Obras" }: { initialTab?: string }) {
  const { state, ledger } = useStore();
  const [tab, setTab] = useState(initialTab);
  const [period, setPeriod] = useState("Todo o histórico");
  const [drill, setDrill] = useState<{ title: string; rows: Cost[] } | null>(
    null,
  );
  const [cost, setCost] = useState<Cost | null>(null);
  const [consumptionPeriod, setConsumptionPeriod] = useState("30 dias");
  const periodDays =
    period === "30 dias" ? 30 : period === "3 meses" ? 90 : period === "6 meses" ? 180 : null;
  const cutoff = periodDays
    ? (() => {
        const start = new Date();
        start.setDate(start.getDate() - periodDays);
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      })()
    : "0000-00-00";
  const end = today();
  const rows = useMemo(() => ledger.filter((c) => c.data >= cutoff && c.data <= end), [ledger, cutoff, end]);
  const periodTimes = useMemo(() => state.times.filter(
    (t) => t.data >= cutoff && t.data <= end,
  ), [state.times, cutoff, end]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [topCount, setTopCount] = useState("10");
  const [inUseOnly, setInUseOnly] = useState(true);

  const invoiceSupplierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of state.invoices) {
      if (inv.id) map.set(inv.id, inv.fornecedor || "Desconhecido");
    }
    return map;
  }, [state.invoices]);

  const suppliers = useMemo(() => {
    const map = new Map<string, { name: string; costs: Cost[]; total: number }>();
    for (const c of rows) {
      if (c.origem === "Fatura" && c.origemId) {
        const name = invoiceSupplierMap.get(c.origemId) || "Outro";
        let entry = map.get(name);
        if (!entry) {
          entry = { name, costs: [], total: 0 };
          map.set(name, entry);
        }
        entry.costs.push(c);
        entry.total += c.valor;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows, invoiceSupplierMap]);

  const extras = useMemo(() => {
    const daily = new Map<string, { person: string; date: string; hours: number }>();
    for (const t of periodTimes) {
      const key = t.pessoaId + "|" + t.data;
      const d = daily.get(key) ?? { person: t.pessoaId, date: t.data, hours: 0 };
      d.hours += t.horas;
      daily.set(key, d);
    }
    return Array.from(daily.values()).map((d) => ({
      ...d,
      extra: Math.max(0, d.hours - effectivePolicy(state, d.person).limiteExtra),
    }));
  }, [periodTimes, state]);

  const monthly = (entries: { date: string; value: number }[]) => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      if (!e.date || e.date < "2024-01") continue;
      const month = e.date.slice(0, 7);
      totals.set(month, (totals.get(month) ?? 0) + e.value);
    }
    const keys = [...totals.keys()].sort();
    if (!keys.length) return [];
    const result: { label: string; value: number }[] = [];
    const [startYear, startMonth] = keys[0].split("-").map(Number);
    const [endYear, endMonth] = keys[keys.length - 1].split("-").map(Number);
    if (!startYear || !startMonth || !endYear || !endMonth) return [];

    let curYear = startYear;
    let curMonth = startMonth;
    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      const label = `${curYear}-${String(curMonth).padStart(2, "0")}`;
      result.push({ label, value: totals.get(label) ?? 0 });
      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
    return result;
  };

  const workCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of rows) {
      if (c.obraId) {
        map.set(c.obraId, (map.get(c.obraId) ?? 0) + c.valor);
      }
    }
    return map;
  }, [rows]);

  const personCostsMap = useMemo(() => {
    const map = new Map<string, Cost[]>();
    for (const c of rows) {
      if (c.pessoaId) {
        let list = map.get(c.pessoaId);
        if (!list) {
          list = [];
          map.set(c.pessoaId, list);
        }
        list.push(c);
      }
    }
    return map;
  }, [rows]);

  const personCompanyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of state.people) {
      map.set(p.id, p.empresaId || "");
    }
    return map;
  }, [state.people]);

  const workHours = useMemo(() => sum(periodTimes, (t) => t.horas), [periodTimes]);
  const travelHours = useMemo(() => sum(periodTimes, (t) => t.horasViagem), [periodTimes]);
  const travelShare = travelHours / Math.max(1, workHours + travelHours) * 100;
  const previousEnd = useMemo(() => new Date(Date.parse(cutoff === "0000-00-00" ? today() : cutoff) - 86400000), [cutoff]);
  const previousStart = useMemo(() => {
    const d = new Date(previousEnd);
    d.setUTCDate(1);
    return d;
  }, [previousEnd]);
  const previousTimes = useMemo(() => (
    period === "Todo o histórico"
      ? []
      : state.times.filter(
          (t) =>
            t.data >= previousStart.toISOString().slice(0, 10) &&
            t.data <= previousEnd.toISOString().slice(0, 10),
        )
  ), [period, state.times, previousStart, previousEnd]);
  const previousTotal = useMemo(() => sum(previousTimes, (t) => t.horas + t.horasViagem), [previousTimes]);
  const travelChange = previousTotal > 0 ? travelShare - sum(previousTimes, (t) => t.horasViagem) / previousTotal * 100 : null;
  const coverageDays = consumptionPeriod === "30 dias" ? 30 : consumptionPeriod === "3 meses" ? 90 : 180;
  const coverageStart = useMemo(() => new Date(Date.parse(today()) - coverageDays * 86400000).toISOString().slice(0, 10), [coverageDays]);
  const criticalStock = useMemo(() => (
    state.articles
      .map((a) => {
        const used = sum(
          state.movements.filter(
            (m) =>
              m.artigoId === a.id &&
              m.tipo !== "Entrada" &&
              m.data >= coverageStart &&
              m.data <= today(),
          ),
          (m) => m.quantidade * (m.tipo === "Devolução" ? -1 : 1),
        );
        const available = stock(state, a.id);
        return {
          a,
          available,
          coverage: available <= 0 ? 0 : used > 0 ? available / (used / coverageDays) : Infinity,
        };
      })
      .filter((r) => r.coverage < 15)
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 5)
  ), [state.articles, state.movements, coverageStart, coverageDays, state]);
  const budget = sum(state.budgets, (b) => b.valor);
  const current = sum(ledger, (c) => c.valor);
  const ledgerByOrigemId = useMemo(() => {
    const map = new Map<string, Cost[]>();
    for (const c of ledger) {
      if (c.origemId) {
        let list = map.get(c.origemId);
        if (!list) {
          list = [];
          map.set(c.origemId, list);
        }
        list.push(c);
      }
    }
    return map;
  }, [ledger]);

  const select = (title: string, r: Cost[]) => setDrill({ title, rows: r });

  const equipmentStats = useMemo(() => {
    const periodByAllocation = new Map<string, Cost[]>();
    for (const c of rows) {
      if (c.origem === "Equipamento" && c.origemId) {
        const list = periodByAllocation.get(c.origemId) ?? [];
        list.push(c);
        periodByAllocation.set(c.origemId, list);
      }
    }
    const totalByAllocation = new Map<string, number>();
    for (const c of ledger) {
      if (c.origem === "Equipamento" && c.origemId) {
        totalByAllocation.set(
          c.origemId,
          (totalByAllocation.get(c.origemId) ?? 0) + c.valor,
        );
      }
    }
    return state.machines
      .map((machine) => {
        const allocations = state.allocations.filter(
          (a) => a.maquinaId === machine.id,
        );
        const periodCharges = allocations.flatMap(
          (a) => periodByAllocation.get(a.id) ?? [],
        );
        const totalTransfer = sum(
          allocations,
          (a) => totalByAllocation.get(a.id) ?? 0,
        );
        const openAllocation = allocations.find((a) => !a.devolucao);
        const daysUsed = periodCharges.length;
        const transfer = sum(periodCharges, (c) => c.valor);
        const internal = daysUsed * (machine.custoInternoDia ?? 0);
        const acquisition = machine.custoAquisicao ?? 0;
        return {
          machine,
          periodCharges,
          daysUsed,
          transfer,
          internal,
          result: transfer - internal,
          recovery:
            acquisition > 0 && totalTransfer > 0
              ? totalTransfer / acquisition
              : null,
          acquisition,
          maintenance: machine.manutencaoAcumulada ?? 0,
          location: openAllocation
            ? `Em obra · ${openAllocation.obraId}`
            : machine.estado,
          open: Boolean(openAllocation),
          active: daysUsed > 0 || Boolean(openAllocation),
        };
      })
      .sort(
        (a, b) =>
          b.transfer - a.transfer ||
          a.machine.numero.localeCompare(b.machine.numero),
      );
  }, [rows, ledger, state.machines, state.allocations]);

  const equipmentRows = inUseOnly
    ? equipmentStats.filter((r) => r.active)
    : equipmentStats;
  const equipmentResult = sum(equipmentStats, (r) => r.result);
  const equipmentInWork = equipmentStats.filter((r) => r.open).length;
  return (
    <>
      <PageHeader
        eyebrow={initialTab === "Consumo de stock" ? "ARMAZÉM" : "GESTÃO"}
        title={
          initialTab === "Consumo de stock" ? "Consumo e reposição" : "Controlo"
        }
        description={
          initialTab === "Consumo de stock"
            ? "O que está a sair, a que ritmo e quanto stock ainda existe."
            : "Da visão global ao registo de origem."
        }
        actions={
          <Select
            label="Período de controlo"
            value={period}
            onChange={(v) => {
              setPeriod(v);
              setSupplierFilter("");
              setDrill(null);
            }}
            options={["30 dias", "3 meses", "6 meses", "Todo o histórico"]}
          />
        }
      />
      <div className="metrics four">
        <Metric
          label="Custos no período"
          value={money(sum(rows, (c) => c.valor))}
          hint={period}
          onClick={() => select("Todos os custos do período", rows)}
        />
        <Metric
          label="Mão de obra"
          value={money(
            sum(
              rows.filter((c) => c.categoria === "Mão de obra"),
              (c) => c.valor,
            ),
          )}
          hint="Estimativa demo"
          onClick={() =>
            select(
              "Mão de obra",
              rows.filter((c) => c.categoria === "Mão de obra"),
            )
          }
        />
        <Metric
          label="Ferramentaria"
          value={money(
            sum(
              rows.filter((c) => c.categoria === "Ferramentaria"),
              (c) => c.valor,
            ),
          )}
          onClick={() =>
            select(
              "Ferramentaria",
              rows.filter((c) => c.categoria === "Ferramentaria"),
            )
          }
        />
        <Metric
          label="Obras em risco"
          value={
            state.works.filter(
              (w) => workFinancials(state, w.id, ledger).risk === "Em risco",
            ).length
          }
          hint="Custo acumulado da obra"
          accent="danger"
        />
      </div>
      <Tabs
        items={[
          "Obras",
          "Custos",
          "Fornecedores",
          "Mão de obra",
          "Consumo de stock",
          "Ferramentaria",
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setDrill(null);
        }}
      />
      {drill ? (
        <>
          <div className="section-top">
            <h2>{drill.title}</h2>
            <Button secondary onClick={() => setDrill(null)}>
              <ArrowLeft size={14} /> Voltar
            </Button>
          </div>
          <CostTable rows={drill.rows} onSelect={setCost} />
        </>
      ) : (
        <>
          {tab === "Obras" && (
            <>
              <div className="section-top">
                <h2>Margem e execução por obra</h2>
                <span className="muted">
                  Margem agregada:{" "}
                  <b>{num(((budget - current) / budget) * 100)}%</b>
                </span>
              </div>
              <Panel title="Top obras por custo realizado" subtitle={period}>
                <Ranking points={state.works.map(w => ({label:w.numero+" · "+w.nome,value:workCostMap.get(w.id) ?? 0,risk:workFinancials(state,w.id,ledger,workCostMap.get(w.id) ?? 0).risk === "Em risco"})).filter(p => p.value > 0).sort((a,b) => b.value-a.value).slice(0,5)} onSelect={label => { const w = state.works.find(w => w.numero+" · "+w.nome === label); if(w) select(label,rows.filter(c => c.obraId === w.id)); }}/>
              </Panel>
              <Note>
                Os limites e a margem usam todo o custo acumulado da obra. O
                seletor de período aplica-se às análises de custos. A margem
                reflete os custos registados, não uma previsão final.
              </Note>
            </>
          )}
          {tab === "Custos" && (
            <div className="grid-two control-categories">
              <Panel title="Distribuição dos custos">
                <CostBreakdown
                  costs={rows}
                  onCategory={(cat) =>
                    select(
                      cat,
                      rows.filter((c) => c.categoria === cat),
                    )
                  }
                />
              </Panel>
              <Panel title="Evolução mensal dos custos" subtitle="Custos registados no período">
                <MonthlyChart currency points={monthly(rows.map(c => ({date:c.data,value:c.valor})))}/>
              </Panel>
            </div>
          )}
          {tab === "Fornecedores" && (
            <>
            <Panel title="Top fornecedores por despesa" subtitle="Selecione um fornecedor para filtrar a tabela">
              <div className="panel-body"><Select label="Mostrar fornecedores" value={topCount} onChange={setTopCount} options={["5","10","20"]}/></div>
              <Ranking points={suppliers.slice(0,Number(topCount)).map(r => ({label:r.name,value:r.total}))} onSelect={setSupplierFilter}/>
            </Panel>
            {supplierFilter && <div className="section-top"><span>Fornecedor: <b>{supplierFilter}</b></span><Button secondary onClick={() => setSupplierFilter("")}>Limpar filtro</Button></div>}
            <Table
              rows={suppliers.filter(r => !supplierFilter || r.name === supplierFilter)}
              onRow={(r) => select(r.name, r.costs)}
              columns={[
                { label: "Fornecedor", render: (r) => <b>{r.name}</b> },
                {
                  label: "Documentos",
                  render: (r) => r.costs.length,
                  align: "right",
                },
                {
                  label: "Obras",
                  render: (r) =>
                    [...new Set(r.costs.map((c) => c.obraId))].join(", "),
                },
                {
                  label: "Despesas",
                  render: (r) => money(r.total),
                  align: "right",
                },
              ]}
            />
            </>
          )}
          {tab === "Mão de obra" && (
            <>
              <div className="metrics four">
                <Metric
                  label="Horas trabalhadas"
                  value={`${num(sum(periodTimes, (t) => t.horas), 1)} h`}
                  hint="Pergunta preservada do Power BI"
                />
                <Metric
                  label="Horas extra"
                  value={`${num(sum(extras, (t) => t.extra), 2)} h`}
                  hint="Calculadas pela política de cada empresa"
                />
                <Metric
                  label="Tempo de viagem"
                  value={`${num(sum(periodTimes, (t) => t.horasViagem), 1)} h`}
                />
                <Metric
                  label="Custo médio / hora"
                  value={money(
                    sum(
                      rows.filter((c) => c.categoria === "Mão de obra"),
                      (c) => c.valor,
                    ) / Math.max(1, sum(periodTimes, (t) => t.horas)),
                  )}
                />
              </div>
              <div className="grid-two">
                <Panel title="Horas trabalhadas por mês" subtitle={period}><MonthlyChart points={monthly(periodTimes.map(t => ({date:t.data,value:t.horas})))}/></Panel>
                <Panel title="Horas extra por mês" subtitle="ACRS: após 8 h · Subcontratados: após 10 h"><MonthlyChart bars points={monthly(extras.map(t => ({date:t.date,value:t.extra})))}/></Panel>
              </div>
              <div className="grid-two">
                <Panel title="Horas extra por empresa" subtitle="Total diário por pessoa, incluindo todas as obras">
                  <Ranking currency={false} points={state.companies.map(company => ({label:company.nome,value:sum(extras.filter(t => personCompanyMap.get(t.person) === company.id),t => t.extra)})).sort((a,b) => b.value-a.value)}/>
                </Panel>
                <Panel title="Peso do tempo de viagem" subtitle="Percentagem das horas trabalhadas e de viagem">
                  <div className="travel-summary"><strong>{num(travelHours,2)} h</strong><span>{num(travelShare)}% das horas registadas</span><div className="ranking-track"><i style={{width:travelShare+"%"}}/></div><small className="muted">{travelChange === null ? "Sem período anterior comparável." : `${travelChange >= 0 ? "+" : ""}${num(travelChange)} p.p. face ao período anterior.`} Tempo de viagem incluído no custo da obra.</small></div>
                </Panel>
              </div>
              <Table
                rows={state.people
                  .map((p) => {
                    const costs = personCostsMap.get(p.id) ?? [];
                    const total = sum(costs, (c) => c.valor);
                    return { p, costs, total };
                  })
                  .filter((r) => r.costs.length > 0)
                  .sort((a, b) => b.total - a.total)}
                onRow={(r) => select(r.p.nome, r.costs)}
                columns={[
                  { label: "Pessoa", render: (r) => <b>{r.p.nome}</b> },
                  {
                    label: "Empresa",
                    render: (r) =>
                      state.companies.find(
                        (company) => company.id === r.p.empresaId,
                      )?.nome ?? "Por confirmar",
                  },
                  {
                    label: "Horas + viagem",
                    render: (r) =>
                      `${num(sum(r.costs, (c) => c.quantidade))} h`,
                    align: "right",
                  },
                  {
                    label: "Custo médio/hora",
                    render: (r) =>
                      money(
                        sum(r.costs, (c) => c.valor) /
                          Math.max(
                            1,
                            sum(r.costs, (c) => c.quantidade),
                          ),
                      ),
                    align: "right",
                  },
                  {
                    label: "Custo estimado",
                    render: (r) => money(sum(r.costs, (c) => c.valor)),
                    align: "right",
                  },
                ]}
              />
              <Note>
                A distribuição pessoa–empresa é demonstrativa. As políticas de
                custo já distinguem funcionários ACRS de subcontratados.
              </Note>
            </>
          )}
          {tab === "Consumo de stock" && (
            <>
              <div className="section-top">
                <h2>Artigos mais consumidos</h2>
                <Select
                  label="Período de consumo"
                  value={consumptionPeriod}
                  onChange={setConsumptionPeriod}
                  options={["30 dias", "3 meses", "6 meses"]}
                />
              </div>
              <Panel title="Cobertura crítica" subtitle="Prioridades de reposição · estimativa pelo consumo líquido do período selecionado">
                <div className="control-ranking">{criticalStock.length ? criticalStock.map(r => <div className="stock-critical-row" key={r.a.id}><span><b>{r.a.descricao}</b><small>{r.a.codigoACRS} · Stock: {qty(r.available,r.a)}</small></span><b>{num(r.coverage,1)} dias</b><Badge>{r.coverage === 0 ? "Crítico" : r.coverage < 7 ? "Baixo" : "Atenção"}</Badge></div>) : <p className="muted">Sem artigos com cobertura inferior a 15 dias.</p>}</div>
              </Panel>
              <Table
                rows={state.articles
                  .map((a) => {
                    const days =
                      consumptionPeriod === "30 dias"
                        ? 30
                        : consumptionPeriod === "3 meses"
                          ? 90
                          : 180;
                    const start = new Date(
                      Date.parse(today()) - days * 86400000,
                    )
                      .toISOString()
                      .slice(0, 10);
                    const ms = state.movements.filter(
                      (m) =>
                        m.artigoId === a.id &&
                        m.tipo !== "Entrada" &&
                        m.data >= start &&
                        m.data <= today(),
                    );
                    return {
                      a,
                      quantity: sum(
                        ms,
                        (m) => m.quantidade * (m.tipo === "Devolução" ? -1 : 1),
                      ),
                      value: sum(
                        ms,
                        (m) =>
                          m.quantidade *
                          m.valorUnitario *
                          (m.tipo === "Devolução" ? -1 : 1),
                      ),
                      costs: ms.flatMap((m) => ledgerByOrigemId.get(m.id) ?? []),
                      movements: ms.filter((m) => m.tipo === "Saída").length,
                      days,
                    };
                  })
                  .filter((r) => r.quantity !== 0)
                  .sort((a, b) => b.quantity - a.quantity)}
                onRow={(r) => select(r.a.descricao, r.costs)}
                columns={[
                  { label: "Código", render: (r) => <b>{r.a.codigoACRS}</b> },
                  { label: "Artigo", render: (r) => r.a.descricao },
                  { label: "Marca", render: (r) => r.a.marca ?? "—" },
                  {
                    label: "Consumo líquido",
                    render: (r) => <b>{qty(r.quantity, r.a)}</b>,
                    align: "right",
                  },
                  {
                    label: "Movimentos",
                    render: (r) => r.movements,
                    align: "right",
                  },
                  {
                    label: "Média / 30 dias",
                    render: (r) => qty((r.quantity / r.days) * 30, r.a),
                    align: "right",
                  },
                  {
                    label: "Valor interno",
                    render: (r) => money(r.value),
                    align: "right",
                  },
                  {
                    label: "Stock atual",
                    render: (r) => qty(stock(state, r.a.id), r.a),
                    align: "right",
                  },
                  {
                    label: "Cobertura",
                    render: (r) =>
                      r.quantity > 0
                        ? `${num(stock(state, r.a.id) / (r.quantity / r.days), 0)} dias`
                        : "—",
                    align: "right",
                  },
                ]}
              />
              <Note>
                Consumo líquido: saídas menos devoluções, pela data efetiva. O
                histórico de armazém é demonstrativo porque não existe no Excel
                nem no Power BI atuais. Unidades e cobertura aguardam validação
                da ACRS.
              </Note>
            </>
          )}
          {tab === "Ferramentaria" && (
            <>
              <div className="metrics four">
                <Metric
                  label="Equipamentos em obra"
                  value={equipmentInWork}
                  hint="Alocados neste momento"
                />
                <Metric
                  label="Valor imputado às obras"
                  value={money(sum(equipmentStats, (r) => r.transfer))}
                  hint="Dias alugados × tarifa, no período"
                  onClick={() =>
                    select(
                      "Valor imputado às obras",
                      rows.filter((c) => c.origem === "Equipamento"),
                    )
                  }
                />
                <Metric
                  label="Custo interno estimado"
                  value={money(sum(equipmentStats, (r) => r.internal))}
                  hint="Dias alugados × custo interno, no período"
                />
                <Metric
                  label="Resultado do período"
                  value={money(equipmentResult)}
                  hint="Valor imputado menos custo interno"
                  accent={equipmentResult < 0 ? "danger" : "positive"}
                />
              </div>
              <div className="section-top">
                <h2>Equipamento: utilização e retorno</h2>
              </div>
              <div className="filter-bar">
                <Button secondary onClick={() => setInUseOnly(!inUseOnly)}>
                  {inUseOnly
                    ? "Ver todo o equipamento"
                    : "Só equipamento com atividade"}
                </Button>
                <span className="muted">
                  {equipmentRows.length} equipamento
                  {equipmentRows.length === 1 ? "" : "s"} apresentados
                </span>
              </div>
              <Table
                rows={equipmentRows}
                rowKey={(r) => r.machine.id}
                empty="Sem equipamento com atividade no período selecionado."
                onRow={(r) =>
                  r.periodCharges.length
                    ? select(
                        `${r.machine.numero} · ${r.machine.nome}`,
                        r.periodCharges,
                      )
                    : undefined
                }
                columns={[
                  {
                    label: "Equipamento",
                    hint: "Número, nome, marca e tipo do equipamento.",
                    render: (r) => (
                      <div>
                        <b>
                          {r.machine.numero} · {r.machine.nome}
                        </b>
                        <small className="block muted">
                          {r.machine.marca} · {r.machine.tipo}
                        </small>
                      </div>
                    ),
                  },
                  {
                    label: "Situação",
                    hint: "Em obra significa que está alocado neste momento. Caso contrário mostra o estado registado no armazém.",
                    render: (r) => <Badge>{r.location}</Badge>,
                  },
                  {
                    label: "Dias",
                    hint: "Dias do período selecionado em que o equipamento esteve alocado a uma obra.",
                    render: (r) => (r.daysUsed ? r.daysUsed : "—"),
                    align: "right",
                  },
                  {
                    label: "Valor às obras",
                    hint: "Valor cobrado às obras no período: dias alugados multiplicado pela tarifa diária.",
                    render: (r) => money(r.transfer),
                    align: "right",
                  },
                  {
                    label: "Custo interno",
                    hint: "Custo estimado para a empresa no período: dias alugados multiplicado pelo custo interno diário.",
                    render: (r) => money(r.internal),
                    align: "right",
                  },
                  {
                    label: "Resultado",
                    hint: "Valor às obras menos custo interno, apenas no período. Não inclui manutenção nem amortização.",
                    render: (r) => (
                      <span
                        style={{
                          color: r.result < 0 ? "#ae4949" : "#487a60",
                        }}
                      >
                        {money(r.result)}
                      </span>
                    ),
                    align: "right",
                  },
                  {
                    label: "Retorno",
                    hint: "Percentagem do valor de aquisição já recuperada pelas transferências para obras, em todo o histórico. O valor por baixo é o preço de compra.",
                    render: (r) => (
                      <div>
                        <b>
                          {r.recovery === null
                            ? "—"
                            : `${num(r.recovery * 100)}%`}
                        </b>
                        <small className="block muted">
                          de {money(r.acquisition)}
                        </small>
                      </div>
                    ),
                    align: "right",
                  },
                ]}
                footer={(items) => [
                  <b key="total">Total</b>,
                  "",
                  `${sum(items, (r) => r.daysUsed)} dias`,
                  money(sum(items, (r) => r.transfer)),
                  money(sum(items, (r) => r.internal)),
                  money(sum(items, (r) => r.result)),
                  "",
                ]}
              />
              <Note>
                As colunas até «Resultado» referem-se apenas ao período
                selecionado. «Retorno» é histórico: compara tudo o que já foi
                transferido para obras com o valor de aquisição. O custo interno
                é uma estimativa demo, a validar com a ACRS. Clique num
                equipamento para ver os encargos que o compõem.
              </Note>
            </>
          )}
        </>
      )}
      {cost && <CostDetail cost={cost} onClose={() => setCost(null)} />}
    </>
  );
}
