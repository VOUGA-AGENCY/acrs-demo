"use client";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useStore } from "./store";
import { costLedger, effectivePolicy, stock, workFinancials } from "@/lib/engine";
import { date, money, num, qty, sum, today } from "@/lib/format";
import type { Cost, Invoice } from "@/types";
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
import { WorkTable } from "./works";
import { DocumentPreview } from "./invoices";
import { MonthlyChart, Ranking } from "./control-charts";
const budgetRubric = (category: string) =>
  ["Mão de obra", "Materiais", "Ferramentaria", "Transportes", "Alojamento"].includes(
    category,
  )
    ? category
    : "Outros";
export function Control({ initialTab = "Obras" }: { initialTab?: string }) {
  const { state, ledger } = useStore();
  const [tab, setTab] = useState(initialTab);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [period, setPeriod] = useState("Todo o histórico");
  const [drill, setDrill] = useState<{ title: string; rows: Cost[] } | null>(
    null,
  );
  const [cost, setCost] = useState<Cost | null>(null);
  const [consumptionPeriod, setConsumptionPeriod] = useState("30 dias");
  const cutoff =
    period === "Este mês"
      ? today().slice(0, 7) + "-01"
      : period === "Agosto 2026"
        ? "2026-08-01"
        : "0000-00-00";
  const end = period === "Agosto 2026" ? "2026-08-31" : today();
  const rows = ledger.filter((c) => c.data >= cutoff && c.data <= end);
  const periodTimes = state.times.filter(
    (t) => t.data >= cutoff && t.data <= end,
  );
  const [supplierFilter, setSupplierFilter] = useState("");
  const [topCount, setTopCount] = useState("10");
  const suppliers = [...new Set(rows.filter(c => c.origem === "Fatura").map(c => state.invoices.find(i => i.id === c.origemId)?.fornecedor ?? ""))].map(name => {
    const costs = rows.filter(c => c.origem === "Fatura" && state.invoices.find(i => i.id === c.origemId)?.fornecedor === name);
    return {name, costs, total: sum(costs,c => c.valor)};
  }).sort((a,b) => b.total-a.total);
  const daily = new Map<string, {person: string; date: string; hours: number}>();
  periodTimes.forEach(t => {
    const key = t.pessoaId + "|" + t.data;
    const d = daily.get(key) ?? {person:t.pessoaId,date:t.data,hours:0};
    d.hours += t.horas; daily.set(key,d);
  });
  const extras = [...daily.values()].map(d => ({...d, extra:Math.max(0,d.hours-effectivePolicy(state,d.person).limiteExtra)}));
  const monthly = (entries: {date:string; value:number}[]) => {
    const totals = new Map<string,number>();
    entries.forEach(e => totals.set(e.date.slice(0,7),(totals.get(e.date.slice(0,7)) ?? 0)+e.value));
    const keys = [...totals.keys()].sort();
    if (!keys.length) return [];
    const result: {label:string;value:number}[] = [];
    const cursor = new Date(keys[0]+"-01T12:00:00Z");
    while(cursor.toISOString().slice(0,7) <= keys[keys.length-1]) {
      const label = cursor.toISOString().slice(0,7);
      result.push({label,value:totals.get(label) ?? 0}); cursor.setUTCMonth(cursor.getUTCMonth()+1);
    }
    return result;
  };
  const workHours = sum(periodTimes,t => t.horas);
  const travelHours = sum(periodTimes,t => t.horasViagem);
  const travelShare = travelHours / Math.max(1,workHours+travelHours)*100;
  const previousEnd = new Date(Date.parse(cutoff === "0000-00-00" ? today() : cutoff)-86400000);
  const previousStart = new Date(previousEnd); previousStart.setUTCDate(1);
  const previousTimes = period === "Todo o histórico" ? [] : state.times.filter(t => t.data >= previousStart.toISOString().slice(0,10) && t.data <= previousEnd.toISOString().slice(0,10));
  const previousTotal = sum(previousTimes,t => t.horas+t.horasViagem);
  const travelChange = previousTotal > 0 ? travelShare-sum(previousTimes,t => t.horasViagem)/previousTotal*100 : null;
  const coverageDays = consumptionPeriod === "30 dias" ? 30 : consumptionPeriod === "3 meses" ? 90 : 180;
  const coverageStart = new Date(Date.parse(today())-coverageDays*86400000).toISOString().slice(0,10);
  const criticalStock = state.articles.map(a => {
    const used = sum(state.movements.filter(m => m.artigoId === a.id && m.tipo !== "Entrada" && m.data >= coverageStart && m.data <= today()),m => m.quantidade*(m.tipo === "Devolução" ? -1 : 1));
    const available = stock(state,a.id);
    return {a,available,coverage:available <= 0 ? 0 : used > 0 ? available/(used/coverageDays) : Infinity};
  }).filter(r => r.coverage < 15).sort((a,b) => a.coverage-b.coverage).slice(0,5);
  const budget = sum(state.budgets, (b) => b.valor);
  const current = sum(ledger, (c) => c.valor);
  const select = (title: string, r: Cost[]) => setDrill({ title, rows: r });
  const purchaseInvoices = state.invoices.filter(
    (i) =>
      i.tipo === "Compra para stock" && i.data >= cutoff && i.data <= end,
  );
  const equipmentStats = state.machines.map((machine) => {
    const allocationIds = state.allocations
      .filter((a) => a.maquinaId === machine.id)
      .map((a) => a.id);
    const charges = rows.filter(
      (c) => c.origem === "Equipamento" && allocationIds.includes(c.origemId),
    );
    const daysUsed = charges.length;
    const transfer = sum(charges, (c) => c.valor);
    const internal = daysUsed * (machine.custoInternoDia ?? 0);
    const maintenance = machine.manutencaoAcumulada ?? 0;
    const acquisition = machine.custoAquisicao ?? 0;
    return {
      machine,
      daysUsed,
      transfer,
      internal,
      maintenance,
      acquisition,
      recovery: acquisition > 0 ? transfer / acquisition : 0,
      result: transfer - internal - maintenance,
    };
  });
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
            options={["Todo o histórico", "Agosto 2026", "Este mês"]}
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
          "Orçamento vs realizado",
          "Categorias",
          "Fornecedores",
          "Mão de obra",
          "Consumo de stock",
          "Ferramentaria",
          "Compras",
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
                <Ranking points={state.works.map(w => ({label:w.numero+" · "+w.nome,value:sum(rows.filter(c => c.obraId === w.id),c => c.valor),risk:workFinancials(state,w.id,ledger).risk === "Em risco"})).filter(p => p.value > 0).sort((a,b) => b.value-a.value).slice(0,5)} onSelect={label => { const w = state.works.find(w => w.numero+" · "+w.nome === label); if(w) select(label,rows.filter(c => c.obraId === w.id)); }}/>
              </Panel>
              <WorkTable rows={state.works} compact />
              <Note>
                Os limites e a margem usam todo o custo acumulado da obra. O
                seletor de período aplica-se às análises de custos. A margem
                reflete os custos registados, não uma previsão final.
              </Note>
            </>
          )}
          {tab === "Categorias" && (
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
          {tab === "Orçamento vs realizado" && (
            <>
              <Table
                rows={state.budgets.flatMap((b) =>
                  b.modo === "Discriminado"
                    ? b.linhas.map((line) => {
                        const realized = sum(
                          ledger.filter(
                            (c) =>
                              c.obraId === b.obraId &&
                              budgetRubric(c.categoria) === line.categoria,
                          ),
                          (c) => c.valor,
                        );
                        const committed = sum(
                          state.invoices.filter(
                            (i) =>
                              i.obraId === b.obraId &&
                              i.estado === "Por validar" &&
                              budgetRubric(i.categoria ?? "Outros") ===
                                line.categoria,
                          ),
                          (i) => i.valor,
                        );
                        return {
                          obraId: b.obraId,
                          category: line.categoria,
                          planned: line.valor,
                          realized,
                          committed,
                        };
                      })
                    : [],
                )}
                columns={[
                  { label: "Obra", render: (r) => <b>{r.obraId}</b> },
                  { label: "Rubrica", render: (r) => r.category },
                  { label: "Previsto", render: (r) => money(r.planned), align: "right" },
                  { label: "Realizado", render: (r) => money(r.realized), align: "right" },
                  { label: "Comprometido", render: (r) => money(r.committed), align: "right" },
                  {
                    label: "Desvio",
                    render: (r) => money(r.planned - r.realized - r.committed),
                    align: "right",
                  },
                ]}
              />
              <Note>
                A comparação utiliza todo o histórico da obra. Documentos por
                validar aparecem como comprometidos, sem entrar no realizado.
              </Note>
            </>
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
                  <Ranking currency={false} points={state.companies.map(company => ({label:company.nome,value:sum(extras.filter(t => state.people.find(p => p.id === t.person)?.empresaId === company.id),t => t.extra)})).sort((a,b) => b.value-a.value)}/>
                </Panel>
                <Panel title="Peso do tempo de viagem" subtitle="Percentagem das horas trabalhadas e de viagem">
                  <div className="travel-summary"><strong>{num(travelHours,2)} h</strong><span>{num(travelShare)}% das horas registadas</span><div className="ranking-track"><i style={{width:travelShare+"%"}}/></div><small className="muted">{travelChange === null ? "Sem período anterior comparável." : `${travelChange >= 0 ? "+" : ""}${num(travelChange)} p.p. face ao mês anterior${period === "Este mês" ? " (mês atual parcial)" : ""}.`} Tempo de viagem incluído no custo da obra.</small></div>
                </Panel>
              </div>
              <Table
                rows={state.people
                  .map((p) => ({
                    p,
                    costs: rows.filter((c) => c.pessoaId === p.id),
                  }))
                  .filter((r) => r.costs.length)
                  .sort(
                    (a, b) =>
                      sum(b.costs, (c) => c.valor) -
                      sum(a.costs, (c) => c.valor),
                  )}
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
                      costs: ledger.filter((c) =>
                        ms.some((m) => m.id === c.origemId),
                      ),
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
                  label="Transferências para obras"
                  value={money(
                    sum(
                      rows.filter((c) => c.origem === "Armazém"),
                      (c) => c.valor,
                    ),
                  )}
                  onClick={() =>
                    select(
                      "Transferências de armazém",
                      rows.filter((c) => c.origem === "Armazém"),
                    )
                  }
                />
                <Metric
                  label="Utilização de máquinas"
                  value={money(
                    sum(
                      rows.filter((c) => c.origem === "Equipamento"),
                      (c) => c.valor,
                    ),
                  )}
                  onClick={() =>
                    select(
                      "Utilização de máquinas",
                      rows.filter((c) => c.origem === "Equipamento"),
                    )
                  }
                />
                <Metric
                  label="Danos e perdas"
                  value={money(
                    sum(
                      rows.filter((c) => c.origem === "Dano / perda"),
                      (c) => c.valor,
                    ),
                  )}
                  onClick={() =>
                    select(
                      "Danos e perdas",
                      rows.filter((c) => c.origem === "Dano / perda"),
                    )
                  }
                />
                <Metric
                  label="Margem interna"
                  value={money(sum(equipmentStats, (r) => r.result))}
                  hint="Cenário demo · por validar"
                />
              </div>
              <Table
                rows={equipmentStats}
                columns={[
                  {
                    label: "Equipamento",
                    render: (r) => (
                      <b>{r.machine.numero} · {r.machine.nome}</b>
                    ),
                  },
                  { label: "Dias imputados", render: (r) => r.daysUsed, align: "right" },
                  { label: "Transferência", render: (r) => money(r.transfer), align: "right" },
                  { label: "Custo interno", render: (r) => money(r.internal), align: "right" },
                  { label: "Manutenção", render: (r) => money(r.maintenance), align: "right" },
                  { label: "Aquisição", render: (r) => money(r.acquisition), align: "right" },
                  { label: "Recuperado", render: (r) => `${num(r.recovery * 100)}%`, align: "right" },
                  { label: "Resultado", render: (r) => <span style={{color:r.result < 0 ? "#ae4949" : "#487a60"}}>{money(r.result)}</span>, align: "right" },
                ]}
              />
              <CostTable
                rows={rows.filter(
                  (c) =>
                    c.categoria === "Ferramentaria" || c.origem === "Armazém",
                )}
                onSelect={setCost}
              />
              <Note>
                Aquisição, custo interno diário e manutenção são valores demo.
                A rentabilidade definitiva exige método de amortização, custos
                reais de manutenção e regras de transferência confirmadas.
              </Note>
            </>
          )}
          {tab === "Compras" && (
            <>
              <Table
                rows={purchaseInvoices}
                onRow={setInvoice}
                columns={[
                  { label: "Data", render: (i) => date(i.data) },
                  { label: "Fornecedor", render: (i) => <b>{i.fornecedor}</b> },
                  { label: "Documento", render: (i) => i.numero },
                  { label: "Destino", render: () => "Stock do armazém" },
                  {
                    label: "Valor",
                    render: (i) => money(i.valor),
                    align: "right",
                  },
                  { label: "Estado", render: (i) => <Badge>{i.estado}</Badge> },
                ]}
              />
              <Note>
                Compras para stock no período selecionado. As faturas
                históricas continuam ligadas às obras originais; não foram
                convertidas retroativamente em movimentos de stock.
              </Note>
            </>
          )}
        </>
      )}
      {invoice && (
        <DocumentPreview invoice={invoice} onClose={() => setInvoice(null)} />
      )}{" "}
      {cost && <CostDetail cost={cost} onClose={() => setCost(null)} />}
    </>
  );
}
