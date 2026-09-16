import { getSupabaseBrowserClient } from "./client";
import type { Allocation, Budget, Invoice, Movement, Profile, State, TimeEntry, Work } from "@/types";

async function fetchAllRows(supabase: any, table: string, orderCol?: string) {
  const pageSize = 1000;
  let all: any[] = [];
  let page = 0;
  while (true) {
    let query = supabase.from(table).select("*");
    if (orderCol) query = query.order(orderCol, { ascending: false });
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

export async function fetchStateFromSupabase(): Promise<State | null> {
  // 1. Tentar primeiro via rota interna /api/state (usa service role, ultra-rápido e sem bloqueios de RLS)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.works) && data.works.length > 0) {
          return data;
        }
      }
    } catch {
      // Em caso de falha de rede na rota, avançar para consulta direta via Supabase client
    }
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  return fetchStateWithClient(supabase);
}

export async function fetchStateWithClient(supabase: any): Promise<State | null> {
  if (!supabase) return null;

  try {
    const [
      works,
      budgetsRes,
      articles,
      people,
      companiesRes,
      times,
      invoices,
      movements,
      machinesRes,
      allocationsRes,
      settingsRowRes,
    ] = await Promise.all([
      fetchAllRows(supabase, "works"),
      supabase.from("budgets").select("*"),
      fetchAllRows(supabase, "articles"),
      fetchAllRows(supabase, "people"),
      supabase.from("companies").select("*"),
      fetchAllRows(supabase, "time_entries"),
      fetchAllRows(supabase, "invoices", "data"),
      fetchAllRows(supabase, "movements", "data"),
      supabase.from("machines").select("*"),
      supabase.from("allocations").select("*"),
      supabase.from("settings").select("*").eq("id", "global").maybeSingle(),
    ]);

    if (!works || works.length === 0) {
      return null;
    }

    const budgets = budgetsRes?.data || [];
    const companies = companiesRes?.data || [];
    const machines = machinesRes?.data || [];
    const allocations = allocationsRes?.data || [];
    const settingsRow = settingsRowRes?.data || null;

    // Orçamentos: lidos 100% diretamente da tabela 'budgets' do Supabase
    const budgetMap = new Map<string, Budget>();
    if (budgets && budgets.length > 0) {
      for (const b of budgets) {
        budgetMap.set(b.obra_id, {
          obraId: b.obra_id,
          valor: Number(b.valor),
          margem: Number(b.margem),
          modo: b.modo || "Simples",
          linhas: b.linhas || [],
          source: b.source || "ACRS",
        });
      }
    }
    // Salvaguarda: garantir que todas as obras têm orçamento registado
    for (const w of works) {
      if (!budgetMap.has(w.id)) {
        budgetMap.set(w.id, {
          obraId: w.id,
          valor: 15000,
          margem: 0.20,
          modo: "Simples",
          linhas: [],
          source: "ACRS",
        });
      }
    }

    const state: State = {
      works: works.map((w: any) => ({
        id: w.id,
        numero: w.numero,
        nome: w.nome,
        local: w.local,
        cliente: w.cliente,
        estado: w.estado,
        source: w.source,
      })),
      articles: articles.map((a: any) => ({
        id: a.id,
        codigoACRS: a.codigo_acrs,
        familia: a.familia,
        material: a.material,
        tamanho: a.tamanho,
        descricao: a.descricao,
        marca: a.marca,
        quantidade: Number(a.quantidade),
        precoUnitario: Number(a.preco_unitario),
        precoTotal: Number(a.preco_total),
        localizacao: a.localizacao,
        unidade: a.unidade,
        precisao: a.precisao,
        source: a.source,
      })),
      people: people.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        custoHora: p.custo_hora != null ? Number(p.custo_hora) : null,
        horasDia: p.horas_dia != null ? Number(p.horas_dia) : null,
        empresaId: p.empresa_id,
        tipo: p.tipo,
        source: p.source,
      })),
      companies: companies.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        source: c.source,
      })),
      times: times.map((t: any) => ({
        id: t.id,
        pessoaId: t.pessoa_id,
        nome: t.nome,
        data: t.data,
        obraId: t.obra_id,
        local: t.local,
        entradaManha: t.entrada_manha,
        saidaManha: t.saida_manha,
        entradaTarde: t.entrada_tarde,
        saidaTarde: t.saida_tarde,
        entradaNoite: t.entrada_noite,
        saidaNoite: t.saida_noite,
        tempoViagem: t.tempo_viagem,
        horas: Number(t.horas),
        horasViagem: Number(t.horas_viagem),
        horasNoturnas: Number(t.horas_noturnas),
        horasExtraExcel: Number(t.horas_extra_excel),
        source: t.source,
      })),
      invoices: invoices.map((i: any) => ({
        id: i.id,
        data: i.data,
        fornecedor: i.fornecedor,
        numero: i.numero,
        obraId: i.obra_id || "",
        categoria: i.categoria,
        valor: Number(i.valor),
        estado: i.estado,
        tipo: i.tipo,
        documento: i.documento_url,
        artigoId: i.artigo_id,
        quantidade: i.quantidade != null ? Number(i.quantidade) : undefined,
        registadoEm: i.registado_em,
        utilizador: i.utilizador,
        validadoEm: i.validado_em,
        validadoPor: i.validado_por,
        ocrStatus: i.ocr_status,
        ocrConfidence: i.ocr_confidence != null ? Number(i.ocr_confidence) : undefined,
        ocrRaw: i.ocr_raw,
        source: i.source,
      })),
      movements: movements.map((m: any) => ({
        id: m.id,
        tipo: m.tipo,
        artigoId: m.artigo_id,
        obraId: m.obra_id || "",
        descricao: m.descricao,
        quantidade: Number(m.quantidade),
        valorUnitario: Number(m.valor_unitario),
        data: m.data,
        registadoEm: m.registado_em,
        utilizador: m.utilizador,
        origemId: m.origem_id,
        totalNaSaida: m.total_na_saida,
        fornecedor: m.fornecedor,
        source: m.source,
      })),
      machines: machines.map((m: any) => ({
        id: m.id,
        numero: m.numero,
        nome: m.nome,
        marca: m.marca,
        modelo: m.modelo,
        estado: m.estado,
        custoDia: Number(m.custo_dia),
        custoInternoDia: m.custo_interno_dia ? Number(m.custo_interno_dia) : undefined,
        custoAquisicao: m.custo_aquisicao ? Number(m.custo_aquisicao) : undefined,
        manutencaoAcumulada: m.manutencao_acumulada ? Number(m.manutencao_acumulada) : undefined,
        tipo: m.tipo,
        source: m.source,
      })),
      allocations: allocations.map((a: any) => ({
        id: a.id,
        maquinaId: a.maquina_id,
        obraId: a.obra_id,
        saida: a.saida,
        devolucao: a.devolucao,
        custoDia: Number(a.custo_dia),
        utilizador: a.utilizador,
        registadoEm: a.registado_em,
        source: a.source,
      })),
      budgets: Array.from(budgetMap.values()),
      settings: settingsRow
        ? {
            minimos: settingsRow.minimos || {},
            valoresInternos: settingsRow.valores_internos || {},
            policy: settingsRow.policy || {
              limiteExtra: 8,
              extra: 0.5,
              noturno: 0.25,
              sabado: 0.5,
              domingo: 0.5,
              feriado: 0.5,
              acumular: false,
              source: "demo",
            },
            personPolicies: settingsRow.person_policies || {},
            companyPolicies: settingsRow.company_policies || {},
            holidays: settingsRow.holidays || [],
          }
        : {
            minimos: {},
            valoresInternos: {},
            policy: {
              limiteExtra: 8,
              extra: 0.5,
              noturno: 0.25,
              sabado: 0.5,
              domingo: 0.5,
              feriado: 0.5,
              acumular: false,
              source: "demo",
            },
            personPolicies: {},
            companyPolicies: {},
            holidays: [],
          },
      manualCosts: [],
    };

    return state;
  } catch (error) {
    console.error("Erro ao sincronizar com base de dados:", error);
    return null;
  }
}

export async function persistInvoiceToSupabase(inv: Invoice, profile: Profile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("invoices").upsert({
    id: inv.id,
    data: inv.data,
    fornecedor: inv.fornecedor,
    numero: inv.numero,
    obra_id: inv.obraId || null,
    categoria: inv.categoria,
    valor: inv.valor,
    estado: inv.estado,
    tipo: inv.tipo,
    documento_url: inv.documento,
    artigo_id: inv.artigoId || null,
    quantidade: inv.quantidade || null,
    ocr_status: inv.ocrStatus || "MANUAL",
    ocr_confidence: inv.ocrConfidence != null ? inv.ocrConfidence : null,
    ocr_raw: inv.ocrRaw || null,
    registado_em: inv.registadoEm || new Date().toISOString(),
    utilizador: inv.utilizador || profile,
    validado_em: inv.validadoEm || null,
    validado_por: inv.validadoPor || null,
    source: inv.source,
  });

  if (inv.items && inv.items.length > 0) {
    try {
      await supabase.from("invoice_items").delete().eq("invoice_id", inv.id);
      await supabase.from("invoice_items").insert(
        inv.items.map((item) => ({
          invoice_id: inv.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          preco_unitario: item.precoUnitario,
          subtotal: item.subtotal,
          iva_taxa: item.ivaTaxa ?? 23,
          artigo_id: item.artigoId || null,
        })),
      );
    } catch (itemErr) {
      console.warn("Aviso ao guardar itens de fatura:", itemErr);
    }
  }

  await supabase.from("audit_logs").insert({
    utilizador: profile,
    perfil: profile,
    acao: inv.estado === "Validada" ? "VALIDATE_INVOICE" : "UPSERT_INVOICE",
    entidade: "invoices",
    entidade_id: inv.id,
    estado_posterior: inv,
  });
}

export async function persistMovementToSupabase(m: Movement, profile: Profile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("movements").upsert({
    id: m.id,
    tipo: m.tipo,
    artigo_id: m.artigoId,
    obra_id: m.obraId || null,
    descricao: m.descricao,
    quantidade: m.quantidade,
    valor_unitario: m.valorUnitario,
    data: m.data,
    registado_em: m.registadoEm,
    utilizador: m.utilizador,
    origem_id: m.origemId || null,
    total_na_saida: m.totalNaSaida || false,
    fornecedor: m.fornecedor || null,
    source: m.source,
  });

  await supabase.from("audit_logs").insert({
    utilizador: profile,
    perfil: profile,
    acao: "CREATE_MOVEMENT",
    entidade: "movements",
    entidade_id: m.id,
    estado_posterior: m,
  });
}

export async function persistAllocationToSupabase(a: Allocation, profile: Profile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("allocations").upsert({
    id: a.id,
    maquina_id: a.maquinaId,
    obra_id: a.obraId,
    saida: a.saida,
    devolucao: a.devolucao || null,
    custo_dia: a.custoDia,
    utilizador: a.utilizador,
    registado_em: a.registadoEm,
    source: a.source,
  });

  // Atualizar estado da máquina
  await supabase
    .from("machines")
    .update({ estado: a.devolucao ? "Disponível" : "Em obra" })
    .eq("id", a.maquinaId);

  await supabase.from("audit_logs").insert({
    utilizador: profile,
    perfil: profile,
    acao: a.devolucao ? "RETURN_ALLOCATION" : "CREATE_ALLOCATION",
    entidade: "allocations",
    entidade_id: a.id,
    estado_posterior: a,
  });
}

export async function persistTimeEntryToSupabase(t: TimeEntry, profile: Profile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("time_entries").upsert({
    id: t.id,
    pessoa_id: t.pessoaId,
    nome: t.nome,
    data: t.data,
    obra_id: t.obraId,
    local: t.local || null,
    entrada_manha: t.entradaManha,
    saida_manha: t.saidaManha,
    entrada_tarde: t.entradaTarde,
    saida_tarde: t.saidaTarde,
    entrada_noite: t.entradaNoite,
    saida_noite: t.saidaNoite,
    tempo_viagem: t.tempoViagem,
    horas: t.horas,
    horas_viagem: t.horasViagem,
    horas_noturnas: t.horasNoturnas,
    horas_extra_excel: t.horasExtraExcel,
    registado_em: t.registadoEm || new Date().toISOString(),
    utilizador: t.utilizador || profile,
    source: t.source,
    source_ref: t.sourceRef || null,
  });
  if (error) throw error;

  await supabase.from("audit_logs").insert({
    utilizador: profile,
    perfil: profile,
    acao: "UPSERT_TIME_ENTRY",
    entidade: "time_entries",
    entidade_id: t.id,
    estado_posterior: t,
  });
}

export async function persistBudgetToSupabase(b: Budget, profile: Profile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("budgets").upsert({
    obra_id: b.obraId,
    valor: b.valor,
    margem: b.margem,
    modo: b.modo,
    linhas: b.linhas,
    source: b.source,
  });

  await supabase.from("audit_logs").insert({
    utilizador: profile,
    perfil: profile,
    acao: "UPSERT_BUDGET",
    entidade: "budgets",
    entidade_id: b.obraId,
    estado_posterior: b,
  });
}

export async function persistWorkToSupabase(w: Work, profile: Profile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("works").upsert({
    id: w.id,
    numero: w.numero,
    nome: w.nome,
    local: w.local,
    cliente: w.cliente,
    estado: w.estado,
    source: w.source,
  });

  await supabase.from("audit_logs").insert({
    utilizador: profile,
    perfil: profile,
    acao: "UPSERT_WORK",
    entidade: "works",
    entidade_id: w.id,
    estado_posterior: w,
  });
}

export function subscribeToSupabaseChanges(onUpdate: () => void) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return () => {};

  let debounceTimer: NodeJS.Timeout | null = null;
  const triggerDebounced = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onUpdate();
    }, 300);
  };

  const channel = supabase
    .channel("acrs-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, triggerDebounced)
    .on("postgres_changes", { event: "*", schema: "public", table: "movements" }, triggerDebounced)
    .on("postgres_changes", { event: "*", schema: "public", table: "allocations" }, triggerDebounced)
    .on("postgres_changes", { event: "*", schema: "public", table: "budgets" }, triggerDebounced)
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
}
