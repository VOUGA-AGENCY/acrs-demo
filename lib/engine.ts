import type {
  Allocation,
  Cost,
  Movement,
  Policy,
  State,
  TimeEntry,
} from "@/types";
import { sum, today } from "./format";
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const days = (a: Allocation, asOf = today()) =>
  Math.max(
    0,
    Math.floor(
      (Date.parse(
        (a.devolucao && a.devolucao < asOf ? a.devolucao : asOf) + "T12:00:00Z",
      ) -
        Date.parse(a.saida + "T12:00:00Z")) /
        86400000,
    ) + 1,
  );
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function timeCost(
  t: TimeEntry,
  rate: number,
  p: Policy,
  dailyHours = t.horas,
  dailyNightHours = t.horasNoturnas,
  holiday = false,
) {
  const extra =
    dailyHours > 0
      ? (Math.max(0, dailyHours - p.limiteExtra) * t.horas) / dailyHours
      : 0;
  const day = new Date(t.data + "T12:00:00Z").getUTCDay();
  const weekday = holiday
    ? p.feriado
    : day === 0
      ? p.domingo
      : day === 6
        ? p.sabado
        : 0;
  const supplements = [
    extra * p.extra,
    t.horasNoturnas * p.noturno,
    t.horas * weekday,
  ];
  const supplement = p.acumular
    ? sum(supplements, (x) => x)
    : dailyHours > 0
      ? (Math.max(
          Math.max(0, dailyHours - p.limiteExtra) * p.extra,
          dailyNightHours * p.noturno,
          dailyHours * weekday,
        ) *
          t.horas) /
        dailyHours
      : 0;
  return {
    extra,
    normal: t.horas - extra,
    total: round((t.horas + t.horasViagem + supplement) * rate),
  };
}
export function effectivePolicy(state: State, personId: string): Policy {
  const person = state.people.find((p) => p.id === personId);
  return {
    ...state.settings.policy,
    ...(person?.empresaId
      ? state.settings.companyPolicies[person.empresaId]
      : undefined),
    ...state.settings.personPolicies[personId],
    source: "demo",
  };
}
export function category(value: string | null) {
  const v = (value ?? "").toLowerCase();
  if (/aliment|refei|restaur/.test(v)) return "Alimentação";
  if (/aloj|hotel/.test(v)) return "Alojamento";
  if (/combust|gasóleo|gasoleo|gasolina/.test(v)) return "Combustível";
  if (/transport|viagem|portagem/.test(v)) return "Transportes";
  if (/ferrament|máquina|maquina|aluguer/.test(v)) return "Ferramentaria";
  if (/estrutura|material|consum|ferro|aço|sold|parafus|metal/.test(v))
    return "Materiais";
  return "Outros";
}
export function costLedger(state: State, asOf = today()): Cost[] {
  const invoiceCosts: Cost[] = state.invoices
    .filter(
      (i) =>
        i.estado === "Validada" &&
        i.tipo === "Despesa de obra" &&
        i.data <= asOf,
    )
    .map((i) => ({
      id: `cost-${i.id}`,
      obraId: i.obraId,
      data: i.data,
      registadoEm: i.registadoEm ?? "",
      origem: "Fatura",
      origemId: i.id,
      descricao: `${i.fornecedor} · ${i.numero}`,
      categoria: category(i.categoria),
      quantidade: 1,
      valorUnitario: i.valor,
      valor: i.valor,
      utilizador:
        i.source === "ACRS" ? "Registo histórico" : (i.utilizador ?? "Demo"),
      source: i.source,
      sourceRef: i.sourceRef,
      nota: i.categoria ?? "Categoria por confirmar",
    }));
  const dayTotals = new Map<string, number>();
  const dayNightTotals = new Map<string, number>();
  state.times.forEach((t) => {
    const key = t.pessoaId + t.data;
    dayTotals.set(key, (dayTotals.get(key) ?? 0) + t.horas);
    dayNightTotals.set(key, (dayNightTotals.get(key) ?? 0) + t.horasNoturnas);
  });
  const timeCosts: Cost[] = state.times
    .filter((t) => t.data <= asOf)
    .map((t) => {
      const p = state.people.find((p) => p.id === t.pessoaId);
      const policy = effectivePolicy(state, t.pessoaId);
      const c = timeCost(
        t,
        p?.custoHora ?? 0,
        policy,
        dayTotals.get(t.pessoaId + t.data),
        dayNightTotals.get(t.pessoaId + t.data),
        state.settings.holidays.includes(t.data),
      );
      return {
        id: `cost-${t.id}`,
        obraId: t.obraId,
        data: t.data,
        registadoEm: t.registadoEm ?? "",
        origem: "Ponto",
        origemId: t.id,
        descricao: t.nome,
        categoria: "Mão de obra",
        quantidade: t.horas + t.horasViagem,
        valorUnitario: p?.custoHora ?? 0,
        valor: c.total,
        utilizador:
          t.source === "ACRS"
            ? "Registo histórico"
            : (t.utilizador ?? "João Catalão"),
        source: "demo",
        sourceRef: t.sourceRef,
        pessoaId: t.pessoaId,
        nota:
          p?.custoHora == null
            ? "Sem tarifa: custo por apurar"
            : "Estimativa demo sobre horas e tarifa reais. Extra diária repartida proporcionalmente pelas obras. Suplementos a validar.",
      };
    });
  const materialCosts: Cost[] = state.movements
    .filter((m) => m.tipo !== "Entrada" && m.data <= asOf)
    .map((m) => ({
      id: `cost-${m.id}`,
      obraId: m.obraId,
      data: m.data,
      registadoEm: m.registadoEm,
      origem: m.tipo === "Outro" ? "Manual" : "Armazém",
      origemId: m.id,
      descricao: m.descricao,
      categoria: "Materiais",
      quantidade: m.quantidade,
      valorUnitario: m.valorUnitario,
      valor: round(
        m.quantidade * m.valorUnitario * (m.tipo === "Devolução" ? -1 : 1),
      ),
      utilizador: m.utilizador,
      source: m.source,
      nota:
        m.tipo === "Devolução" ? `Crédito da saída ${m.origemId}` : undefined,
    }));
  const machineCosts: Cost[] = state.allocations
    .filter((a) => a.saida <= asOf)
    .flatMap((a) =>
      Array.from({ length: days(a, asOf) }, (_, index) => {
        const day = new Date(
          Date.parse(a.saida + "T12:00:00Z") + index * 86400000,
        )
          .toISOString()
          .slice(0, 10);
        return {
          id: `cost-${a.id}-${day}`,
          obraId: a.obraId,
          data: day,
          registadoEm: a.registadoEm,
          origem: "Equipamento",
          origemId: a.id,
          descricao:
            state.machines.find((m) => m.id === a.maquinaId)?.nome ?? "",
          categoria: "Ferramentaria",
          quantidade: 1,
          valorUnitario: a.custoDia,
          valor: round(a.custoDia),
          utilizador: a.utilizador,
          source: "demo" as const,
          nota: `Utilização do dia ${day}. Dias inclusivos; tarifa demonstrativa congelada na alocação.`,
        };
      }),
    );
  return [
    ...invoiceCosts,
    ...timeCosts,
    ...materialCosts,
    ...machineCosts,
    ...state.manualCosts.filter((c) => c.data <= asOf),
  ].sort((a, b) => b.data.localeCompare(a.data));
}
export function workFinancials(
  state: State,
  id: string,
  ledger = costLedger(state),
) {
  const budget = state.budgets.find((b) => b.obraId === id);
  const cost = sum(
    ledger.filter((c) => c.obraId === id),
    (c) => c.valor,
  );
  const value = budget?.valor ?? 0;
  const max = value * (1 - (budget?.margem ?? 0));
  return {
    budget: value,
    target: budget?.margem ?? 0,
    max,
    cost,
    available: max - cost,
    consumption: max > 0 ? cost / max : 0,
    margin: value > 0 ? (value - cost) / value : 0,
    risk:
      max > 0
        ? cost >= max
          ? "Em risco"
          : cost >= max * 0.85
            ? "Atenção"
            : "Saudável"
        : "Sem orçamento",
  };
}
export function stock(state: State, id: string, asOf = today()) {
  const base = state.articles.find((a) => a.id === id)?.quantidade ?? 0;
  return round(
    base +
      sum(
        state.movements.filter(
          (m) =>
            m.artigoId === id &&
            m.tipo !== "Outro" &&
            (m.data <= asOf || m.tipo === "Saída"),
        ),
        (m) => m.quantidade * (m.tipo === "Saída" ? -1 : 1),
      ),
  );
}
export function returnable(state: State, movementId: string) {
  const out = state.movements.find((m) => m.id === movementId);
  if (!out || out.tipo !== "Saída" || out.totalNaSaida || out.data > today())
    return 0;
  return round(
    out.quantidade -
      sum(
        state.movements.filter(
          (m) => m.tipo === "Devolução" && m.origemId === out.id,
        ),
        (m) => m.quantidade,
      ),
  );
}
export function applyMovement(state: State, m: Movement): State {
  if (!Number.isFinite(m.quantidade) || m.quantidade <= 0)
    throw new Error("Indique uma quantidade superior a zero.");
  if (!Number.isFinite(m.valorUnitario) || m.valorUnitario < 0)
    throw new Error("Indique um valor unitário válido.");
  if (!validDate(m.data)) throw new Error("Indique uma data efetiva válida.");
  if (m.tipo !== "Entrada" && !state.works.some((w) => w.id === m.obraId))
    throw new Error("Selecione a obra.");
  if (m.tipo !== "Outro" && !state.articles.some((a) => a.id === m.artigoId))
    throw new Error("Selecione um artigo.");
  const article = state.articles.find((a) => a.id === m.artigoId);
  if (article?.precisao === 0 && !Number.isInteger(m.quantidade))
    throw new Error(`A unidade ${article.unidade ?? "un."} exige quantidade inteira.`);
  if (m.tipo === "Saída" && m.quantidade > stock(state, m.artigoId))
    throw new Error("Quantidade superior ao stock disponível.");
  if (m.tipo === "Saída" && m.totalNaSaida && !Number.isInteger(m.quantidade))
    throw new Error("Indique um número inteiro de bobines.");
  if (m.tipo === "Devolução") {
    const out = state.movements.find((o) => o.id === m.origemId);
    if (
      !out ||
      out.obraId !== m.obraId ||
      out.artigoId !== m.artigoId ||
      m.quantidade > returnable(state, out.id)
    )
      throw new Error("A devolução excede o saldo da saída original.");
    if (m.data < out.data)
      throw new Error("A devolução não pode anteceder a saída.");
    m = { ...m, valorUnitario: out.valorUnitario };
  }
  return { ...state, movements: [m, ...state.movements] };
}
export function validateInvoice(
  state: State,
  invoiceId: string,
  user: string,
): State {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice || invoice.estado !== "Por validar")
    throw new Error("A fatura já foi processada ou não existe.");
  let next: State = {
    ...state,
    invoices: state.invoices.map((i) =>
      i.id === invoiceId
        ? {
            ...i,
            estado: "Validada" as const,
            validadoEm: new Date().toISOString(),
            validadoPor: user,
          }
        : i,
    ),
  };
  if (invoice.tipo === "Compra para stock") {
    if (!invoice.artigoId || !invoice.quantidade)
      throw new Error("Associe um artigo e uma quantidade antes de validar.");
    const article = state.articles.find((a) => a.id === invoice.artigoId);
    next = applyMovement(next, {
      id: `mov-${invoice.id}`,
      tipo: "Entrada",
      artigoId: invoice.artigoId,
      obraId: "",
      descricao: `${article?.descricao ?? "Artigo"} · ${invoice.fornecedor}`,
      quantidade: invoice.quantidade,
      valorUnitario: invoice.valor / invoice.quantidade,
      data: invoice.data,
      registadoEm: new Date().toISOString(),
      utilizador: user,
      source: "demo",
      origemId: invoice.id,
    });
  }
  return next;
}
export function applyAllocation(state: State, a: Allocation): State {
  const m = state.machines.find((m) => m.id === a.maquinaId);
  if (
    !m ||
    m.estado !== "Disponível" ||
    state.allocations.some((x) => x.maquinaId === m.id && !x.devolucao)
  )
    throw new Error("O equipamento não está disponível.");
  if (
    !state.works.some((w) => w.id === a.obraId) ||
    !validDate(a.saida) ||
    a.custoDia < 0 ||
    !Number.isFinite(a.custoDia)
  )
    throw new Error("Preencha obra, data e custo diário.");
  if (
    state.allocations.some(
      (x) =>
        x.maquinaId === a.maquinaId &&
        a.saida <= (x.devolucao ?? "9999-12-31") &&
        (a.devolucao ?? "9999-12-31") >= x.saida,
    )
  )
    throw new Error(
      "As datas sobrepõem uma alocação existente deste equipamento.",
    );
  return { ...state, allocations: [a, ...state.allocations] };
}
export function intervals(t: TimeEntry): [number, number][] {
  const base = Date.parse(t.data + "T00:00:00Z") / 60000;
  const pairs = [
    [t.entradaManha, t.saidaManha],
    [t.entradaTarde, t.saidaTarde],
    [t.entradaNoite, t.saidaNoite],
  ];
  return pairs
    .filter(([a, b]) => a && b && a !== b)
    .map(([a, b]) => {
      const minutes = (s: string) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m;
      };
      const start = minutes(a!);
      let end = minutes(b!);
      if (end < start) end += 1440;
      return [base + start, base + end];
    });
}
export function validateTimeEntry(state: State, t: TimeEntry) {
  if (!validDate(t.data) || !state.works.some((w) => w.id === t.obraId))
    throw new Error("Selecione a obra e uma data válida.");
  const own = intervals(t);
  const overlaps = (a: [number, number], b: [number, number]) =>
    a[0] < b[1] && b[0] < a[1];
  if (own.some((a, i) => own.some((b, j) => i !== j && overlaps(a, b))))
    throw new Error(
      "Os horários deste registo sobrepõem-se. Corrija os intervalos.",
    );
  const others = state.times
    .filter(
      (x) =>
        x.pessoaId === t.pessoaId &&
        x.id !== t.id &&
        Math.abs(Date.parse(x.data) - Date.parse(t.data)) <= 86400000,
    )
    .flatMap(intervals);
  if (own.some((a) => others.some((b) => overlaps(a, b))))
    throw new Error(
      "Já existe um registo sobreposto desta pessoa. Edite o registo existente.",
    );
}
