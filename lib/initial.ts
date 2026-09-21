import inventory from "@/data/source/inventory.json";
import works from "@/data/source/obras.json";
import people from "@/data/source/pessoas.json";
import invoices from "@/data/source/faturas.json";
import times from "@/data/source/ponto.json";
import summary from "@/data/source/excel-summary.json";
import { allocations, companies, machines, movements, policy } from "@/data/demo/scenario";
import { costLedger, round } from "./engine";
import { sum } from "./format";
import type { Article, Person, State, TimeEntry } from "@/types/index";
export function initialState(): State {
  const selected = [
    "25094",
    ...summary.obraIdsSelecionadas.filter((x) => x !== "25094"),
  ];
  const consumptionArticles = [
    "inv-p07-r023",
    "inv-p07-r030",
    "inv-p08-r020",
    "inv-p09-r015",
    "inv-p07-r041",
  ];
  const historicalMovements = Array.from({ length: 30 }, (_, index) => {
    const article = (inventory as Article[]).find(
      (a) => a.id === consumptionArticles[index % consumptionArticles.length],
    )!;
    const date = new Date(Date.UTC(2026, 8, 6) - index * 5 * 86400000)
      .toISOString()
      .slice(0, 10);
    const isBobbin = article.descricao.toLowerCase().includes("bobine");
    return {
      id: `demo-consumo-${index + 1}`,
      tipo: "Saída" as const,
      artigoId: article.id,
      obraId: selected[index % selected.length],
      descricao: `${article.descricao} · ${article.codigoACRS}`,
      quantidade: isBobbin ? 1 : 1 + (index % 3),
      valorUnitario: round(article.precoUnitario * 1.1),
      data: date,
      registadoEm: `${date}T17:00:00.000Z`,
      utilizador: "Armazém",
      source: "demo" as const,
      totalNaSaida: isBobbin,
    };
  });
  const sourcePeople = people as Person[];
  const acrsHeadcount = Math.ceil(sourcePeople.length * 0.6);
  const assignedPeople = sourcePeople.map((person, index) => {
    const company =
      index < acrsHeadcount
        ? companies[0]
        : companies[1 + ((index - acrsHeadcount) % 4)];
    return {
      ...person,
      empresaId: company.id,
      tipo: company.tipo === "Interna" ? "Funcionário ACRS" : "Subcontratado",
    };
  });
  const state: State = {
    works: selected.map((id, i) => {
      const w = works.find((w) => w.id === id)!;
      return {
        id: w.id,
        numero: w.numero,
        nome: w.nome,
        local: w.local,
        cliente: `Cliente ${(i % 4) + 1} · demo`,
        estado: i === 10 ? "Concluída" : "Em curso",
        source: "ACRS",
      };
    }),
    articles: (inventory as Article[]).map((a) => ({
      ...a,
      unidade: a.descricao.toLowerCase().includes("bobine")
        ? "bobine"
        : a.familia === "TUBO"
          ? "m"
          : "un.",
      precisao: a.familia === "TUBO" ? 3 : 0,
      unidadeSource: "demo" as const,
    })),
    people: assignedPeople,
    companies: [...companies],
    times: times as TimeEntry[],
    invoices: invoices.map((i, index) => ({
      ...i,
      estado: index % 41 === 0 ? "Por validar" : "Validada",
      tipo: "Despesa de obra",
      source: "ACRS",
    })) as State["invoices"],
    movements: [...movements, ...historicalMovements],
    machines: machines.map((m, index) => ({
      ...m,
      custoInternoDia: round(m.custoDia * 0.58),
      custoAquisicao: 1800 + index * 650,
      manutencaoAcumulada: 90 + index * 35,
    })),
    allocations: [...allocations],
    budgets: [],
    settings: {
      minimos: Object.fromEntries(
        inventory
          .filter((a, i) => a.quantidade > 0 && i % 37 === 0)
          .map((a) => [a.id, Math.ceil(a.quantidade * 1.2)]),
      ),
      valoresInternos: Object.fromEntries(
        inventory.map((a) => [a.id, round(a.precoUnitario * 1.1)]),
      ),
      policy: { ...policy },
      personPolicies: {},
      companyPolicies: Object.fromEntries(
        companies
          .filter((company) => company.tipo === "Subcontratada")
          .map((company) => [
            company.id,
            {
              limiteExtra: 10,
              extra: 0.5,
              noturno: 0.25,
              sabado: 0.5,
              domingo: 0.5,
              feriado: 0.5,
              acumular: false,
              source: "demo" as const,
            },
          ]),
      ),
      holidays: [],
    },
    manualCosts: [],
  };
  // Keep the initial commercial scenario stable across static builds and visits.
  const ledger = costLedger(state, "2026-09-11");
  const consumption = [
    0.64, 0.93, 0.68, 0.72, 1.04, 0.56, 0.88, 0.62, 0.48, 0.73, 0.96, 0.76,
  ];
  state.budgets = state.works.map((w, i) => {
    const value =
      Math.ceil(
        Math.max(
          2000,
          sum(
            ledger.filter((c) => c.obraId === w.id),
            (c) => c.valor,
          ) /
            (0.8 * consumption[i]),
        ) / 100,
      ) * 100;
    const maximum = value * 0.8;
    const discriminated = i < 3;
    return {
      obraId: w.id,
      valor: value,
      margem: 0.2,
      modo: discriminated ? "Discriminado" : "Simples",
      linhas: discriminated
        ? [
            { categoria: "Mão de obra", valor: round(maximum * 0.42) },
            { categoria: "Materiais", valor: round(maximum * 0.15) },
            { categoria: "Ferramentaria", valor: round(maximum * 0.18) },
            { categoria: "Transportes", valor: round(maximum * 0.06) },
            { categoria: "Alojamento", valor: round(maximum * 0.09) },
            { categoria: "Outros", valor: round(maximum * 0.1) },
          ]
        : [],
      source: "demo" as const,
    };
  });
  return state;
}
