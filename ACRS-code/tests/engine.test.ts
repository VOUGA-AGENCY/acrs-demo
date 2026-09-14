import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../lib/initial";
import {
  applyAllocation,
  applyMovement,
  costLedger,
  effectivePolicy,
  returnable,
  round,
  stock,
  timeCost,
  validateInvoice,
  validateTimeEntry,
  workFinancials,
} from "../lib/engine";
import { sum, today } from "../lib/format";
import type { Allocation, Movement, State, TimeEntry } from "../types";
const day = today();
const move = (patch: Partial<Movement> = {}): Movement => ({
  id: "test-out",
  tipo: "Saída",
  artigoId: "inv-p07-r023",
  obraId: "25094",
  descricao: "Disco de corte BERNER",
  quantidade: 20,
  valorUnitario: 1.1,
  data: day,
  registadoEm: new Date().toISOString(),
  utilizador: "Armazém",
  source: "demo",
  ...patch,
});
test("inventário integral e variantes preservadas", () => {
  const s = initialState();
  assert.equal(s.articles.length, 485);
  assert.equal(round(sum(s.articles, (a) => a.precoTotal)), 46325.87);
  assert.equal(new Set(s.articles.map((a) => a.id)).size, 485);
  assert.equal(
    s.articles.filter((a) => a.codigoACRS === "DC125FR1.0").length,
    3,
  );
});
test("saída e devolução atualizam stock/custo pelo valor original", () => {
  const a = initialState();
  const base = stock(a, "inv-p07-r023");
  const cost = workFinancials(a, "25094").cost;
  const b = applyMovement(a, move());
  assert.equal(stock(b, "inv-p07-r023"), base - 20);
  assert.equal(round(workFinancials(b, "25094").cost - cost), 22);
  b.settings.valoresInternos["inv-p07-r023"] = 100;
  const c = applyMovement(
    b,
    move({
      id: "test-return",
      tipo: "Devolução",
      origemId: "test-out",
      quantidade: 10,
      valorUnitario: 999,
    }),
  );
  assert.equal(stock(c, "inv-p07-r023"), base - 10);
  assert.equal(round(workFinancials(c, "25094").cost - cost), 11);
  assert.equal(returnable(c, "test-out"), 10);
  assert.throws(() =>
    applyMovement(
      c,
      move({
        id: "too-many",
        tipo: "Devolução",
        origemId: "test-out",
        quantidade: 11,
      }),
    ),
  );
});
test("impede stock negativo, quantidade inválida e data inválida", () => {
  const s = initialState();
  assert.throws(() => applyMovement(s, move({ quantidade: 100000 })));
  assert.throws(() => applyMovement(s, move({ quantidade: 0 })));
  assert.throws(() => applyMovement(s, move({ data: "2026-02-31" })));
});
test("cada bobine retirada é integral, sem consumir todo o artigo", () => {
  const a = initialState();
  const id = "inv-p07-r041";
  const base = stock(a, id);
  const b = applyMovement(
    a,
    move({ artigoId: id, quantidade: 2, totalNaSaida: true }),
  );
  assert.equal(stock(b, id), base - 2);
  assert.equal(returnable(b, "test-out"), 0);
  assert.throws(() =>
    applyMovement(
      b,
      move({
        artigoId: id,
        tipo: "Devolução",
        quantidade: 1,
        origemId: "test-out",
      }),
    ),
  );
  assert.throws(() =>
    applyMovement(a, move({ artigoId: id, quantidade: 1.25, totalNaSaida: true })),
  );
});
test("fatura pendente só produz efeito ao validar", () => {
  const a = initialState();
  const articleId = "inv-p07-r023";
  const initialStock = stock(a, articleId);
  const invoice = {
    ...a.invoices[0],
    id: "pending-stock",
    tipo: "Compra para stock" as const,
    estado: "Por validar" as const,
    artigoId: articleId,
    quantidade: 5,
    valor: 50,
    source: "demo" as const,
  };
  a.invoices = [invoice, ...a.invoices];
  assert.equal(stock(a, articleId), initialStock);
  const b = validateInvoice(a, invoice.id, "João Catalão");
  assert.equal(stock(b, articleId), initialStock + 5);
  assert.equal(
    b.invoices.find((i) => i.id === invoice.id)?.estado,
    "Validada",
  );
  assert.throws(() => validateInvoice(b, invoice.id, "João Catalão"));
});

test("fatura direta pendente não entra no custo até ser validada", () => {
  const base = initialState();
  const invoice = {
    ...base.invoices[0],
    id: "invoice-direct-validation",
    obraId: base.works[0].id,
    tipo: "Despesa de obra" as const,
    categoria: "Transportes",
    valor: 321.45,
    estado: "Por validar" as const,
  };
  const pending = { ...base, invoices: [...base.invoices, invoice] };
  assert.equal(
    costLedger(pending).some((cost) => cost.origemId === invoice.id),
    false,
  );
  const validated = validateInvoice(pending, invoice.id, "João Catalão");
  const cost = costLedger(validated).find(
    (entry) => entry.origemId === invoice.id,
  );
  assert.equal(cost?.valor, 321.45);
  assert.equal(cost?.categoria, "Transportes");
});
test("entrada de compra não cria custo direto na obra", () => {
  const a = initialState();
  const total = sum(costLedger(a), (c) => c.valor);
  const b = applyMovement(
    a,
    move({ tipo: "Entrada", obraId: "", origemId: "invoice-stock" }),
  );
  assert.equal(
    sum(costLedger(b), (c) => c.valor),
    total,
  );
  assert.equal(stock(b, "inv-p07-r023"), stock(a, "inv-p07-r023") + 20);
});
test("reserva futura reduz disponível e não antecipa custo", () => {
  const a = initialState();
  const future = new Date(Date.parse(day) + 86400000)
    .toISOString()
    .slice(0, 10);
  const b = applyMovement(a, move({ data: future }));
  assert.equal(stock(b, "inv-p07-r023"), stock(a, "inv-p07-r023") - 20);
  assert.equal(
    workFinancials(a, "25094").cost,
    workFinancials(b, "25094").cost,
  );
});
test("alocações não sobrepõem e tarifa histórica é congelada", () => {
  const a = initialState();
  const allocation: Allocation = {
    id: "test-al",
    maquinaId: "eq-002",
    obraId: "25094",
    saida: "2026-09-02",
    devolucao: null,
    custoDia: 15,
    utilizador: "Vítor",
    registadoEm: day,
    source: "demo",
  };
  assert.throws(() => applyAllocation(a, allocation));
  const b = applyAllocation(a, { ...allocation, saida: day });
  b.machines.find((m) => m.id === "eq-002")!.custoDia = 999;
  assert.equal(costLedger(b).find((c) => c.origemId === "test-al")?.valor, 15);
  assert.throws(() =>
    applyAllocation(b, { ...allocation, id: "other", saida: day }),
  );
});
test("custo de equipamento é distribuído pelas datas de utilização", () => {
  const a = initialState();
  a.allocations = [
    {
      id: "span",
      maquinaId: "eq-001",
      obraId: "25094",
      saida: "2026-08-30",
      devolucao: "2026-09-02",
      custoDia: 10,
      utilizador: "Vítor",
      registadoEm: day,
      source: "demo",
    },
  ];
  const c = costLedger(a, "2026-09-11").filter((c) => c.origemId === "span");
  assert.equal(c.length, 4);
  assert.equal(
    sum(
      c.filter((c) => c.data.startsWith("2026-09")),
      (c) => c.valor,
    ),
    20,
  );
});
test("horas extra são diárias e distribuídas entre obras", () => {
  const a = initialState();
  const original = a.times[0];
  a.people.find((p) => p.id === original.pessoaId)!.custoHora = 10;
  a.settings.policy = {
    limiteExtra: 8,
    extra: 0.5,
    noturno: 0,
    sabado: 0,
    domingo: 0,
    feriado: 0,
    acumular: false,
    source: "demo",
  };
  a.times = [
    { ...original, id: "a", horas: 6, horasNoturnas: 0, horasViagem: 0 },
    {
      ...original,
      id: "b",
      obraId: "26095",
      horas: 6,
      horasNoturnas: 0,
      horasViagem: 0,
    },
  ];
  const costs = costLedger(a).filter((c) => c.origem === "Ponto");
  assert.equal(
    sum(costs, (c) => c.valor),
    140,
  );
  assert.equal(costs[0].valor, 70);
  assert.equal(costs[1].valor, 70);
});
test("políticas distinguem ACRS e subcontratados e incluem viagem", () => {
  const state = initialState();
  const acrs = state.people.find((p) => p.empresaId === "company-acrs")!;
  const subcontractor = state.people.find(
    (p) => p.empresaId === "company-a",
  )!;
  const acrsPolicy = effectivePolicy(state, acrs.id);
  const subcontractorPolicy = effectivePolicy(state, subcontractor.id);
  assert.equal(state.companies.length, 5);
  assert.ok(
    state.people.filter((p) => p.empresaId === "company-acrs").length >
      state.people.filter((p) => p.empresaId === "company-a").length,
  );
  assert.equal(acrsPolicy.limiteExtra, 8);
  assert.equal(subcontractorPolicy.limiteExtra, 10);
  const base = state.times[0];
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-14", horas: 9, horasViagem: 0, horasNoturnas: 0 },
      10,
      acrsPolicy,
    ).total,
    95,
  );
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-14", horas: 11, horasViagem: 0, horasNoturnas: 0 },
      10,
      subcontractorPolicy,
    ).total,
    115,
  );
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-14", horas: 8, horasViagem: 2, horasNoturnas: 0 },
      10,
      acrsPolicy,
    ).total,
    100,
  );
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-14", horas: 8, horasViagem: 0, horasNoturnas: 2 },
      10,
      acrsPolicy,
    ).total,
    85,
  );
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-12", horas: 8, horasViagem: 0, horasNoturnas: 0 },
      10,
      acrsPolicy,
    ).total,
    120,
  );
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-13", horas: 8, horasViagem: 0, horasNoturnas: 0 },
      10,
      acrsPolicy,
    ).total,
    120,
  );
  assert.equal(
    timeCost(
      { ...base, data: "2026-09-14", horas: 8, horasViagem: 0, horasNoturnas: 0 },
      10,
      acrsPolicy,
      8,
      0,
      true,
    ).total,
    120,
  );
});
test("dividir um dia por obras não altera o suplemento dominante", () => {
  const a = initialState();
  const original = a.times[0];
  a.people.find((p) => p.id === original.pessoaId)!.custoHora = 10;
  a.settings.policy = {
    limiteExtra: 8,
    extra: 0.5,
    noturno: 0.25,
    sabado: 0,
    domingo: 0,
    feriado: 0,
    acumular: false,
    source: "demo",
  };
  a.times = [
    {
      ...original,
      id: "day",
      horas: 8,
      horasNoturnas: 0,
      horasViagem: 0,
    },
    {
      ...original,
      id: "night",
      obraId: "26095",
      horas: 4,
      horasNoturnas: 4,
      horasViagem: 0,
    },
  ];
  const split = sum(
    costLedger(a).filter((c) => c.origem === "Ponto"),
    (c) => c.valor,
  );
  assert.equal(split, 140);
  assert.equal(
    timeCost(
      { ...original, horas: 12, horasNoturnas: 4, horasViagem: 0 },
      10,
      a.settings.policy,
      12,
      4,
    ).total,
    140,
  );
});
test("horários sobrepostos no registo e noutras obras são rejeitados", () => {
  const a = initialState();
  const t = {
    ...a.times[0],
    id: "check",
    data: day,
    entradaManha: "08:00",
    saidaManha: "12:00",
    entradaTarde: "10:00",
    saidaTarde: "18:00",
  };
  assert.throws(() => validateTimeEntry(a, t));
  a.times = [{ ...t, entradaTarde: null, saidaTarde: null }];
  assert.throws(() =>
    validateTimeEntry(a, {
      ...t,
      id: "check-2",
      entradaTarde: null,
      saidaTarde: null,
    }),
  );
});
test("orçamento deriva máximo, disponível e margem sem divisões por zero", () => {
  const a = initialState();
  a.budgets = [
    {
      obraId: "25094",
      valor: 100000,
      margem: 0.2,
      modo: "Simples",
      linhas: [],
      source: "demo",
    },
  ];
  const f = workFinancials(a, "25094");
  assert.equal(f.max, 80000);
  assert.equal(f.available, 80000 - f.cost);
  assert.equal(f.margin, (100000 - f.cost) / 100000);
  a.budgets = [];
  const none = workFinancials(a, "25094");
  assert.equal(none.risk, "Sem orçamento");
  assert.ok(Number.isFinite(none.consumption));
});
