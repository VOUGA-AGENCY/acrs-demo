import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import inventory from "../data/source/inventory.json" with { type: "json" };
import worksFull from "../data/source/obras-full.json" with { type: "json" };
import people from "../data/source/pessoas.json" with { type: "json" };
import pontoFull from "../data/source/ponto-full.json" with { type: "json" };
import faturasFull from "../data/source/faturas-full.json" with { type: "json" };
import categories from "../data/source/categorias.json" with { type: "json" };
import suppliers from "../data/source/fornecedores.json" with { type: "json" };
import {
  allocations,
  companies,
  machines,
  movements,
} from "../data/demo/scenario";
import { initialState } from "../lib/initial";

// Carregar variáveis de ambiente de .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [k, ...v] = trimmed.split("=");
      if (k && v.length > 0) {
        process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Erro: Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) no ficheiro .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function batchInsert(table: string, rows: any[], chunkSize = 150, onConflict = "id") {
  console.log(`⏳ A inserir ${rows.length} registos na tabela '${table}'...`);
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`❌ Erro ao inserir chunk ${i}-${i + chunk.length} em '${table}':`, error.message);
      throw error;
    }
  }
  console.log(`✅ Tabela '${table}' preenchida com sucesso! (${rows.length} registos)`);
}

async function seed() {
  console.log("🚀 A iniciar o povoamento COMPLETO da base de dados Supabase da ACRS...");

  const baseState = initialState();

  // 1. Perfis de demonstração
  const demoProfiles = [
    { nome: "João Catalão", email: "admin@acrs.pt", perfil: "admin", avatar: "JC" },
    { nome: "Secretariado ACRS", email: "secretariado@acrs.pt", perfil: "secretariado", avatar: "SEC" },
    { nome: "Armazém Central", email: "armazem@acrs.pt", perfil: "armazem", avatar: "ARM" },
    { nome: "Equipa de Campo", email: "terreno@acrs.pt", perfil: "terreno", avatar: "TER" },
  ];
  await supabase.from("profiles").upsert(demoProfiles, { onConflict: "email" });
  console.log("✅ Perfis de demonstração criados (Admin, Secretariado, Armazém, Terreno).");

  // 2. Empresas
  const companyRows = companies.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    source: c.source,
  }));
  await batchInsert("companies", companyRows);

  // 3. Categorias e Fornecedores
  try {
    const catRows = categories.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      source: "ACRS",
    }));
    await batchInsert("categories", catRows, 100);
  } catch {
    console.warn("ℹ️ Tabela 'categories' não criada no Supabase; a continuar...");
  }

  try {
    const suppRows = suppliers.map((s: any) => ({
      id: s.id,
      nome: s.nome,
      source: "ACRS",
    }));
    await batchInsert("suppliers", suppRows, 100);
  } catch {
    console.warn("ℹ️ Tabela 'suppliers' não criada no Supabase; a continuar...");
  }

  // 4. Obras (TODAS as 240 obras reais do Excel)
  const workRows = worksFull.map((w: any) => ({
    id: w.id,
    numero: w.numero || w.id,
    nome: w.nome || `Obra ${w.id}`,
    local: w.local,
    cliente: w.cliente || (w.nome ? `Cliente ${w.nome}` : "Cliente Geral"),
    estado: w.estado || "Em curso",
    source: w.source || "ACRS",
  }));
  await batchInsert("works", workRows);

  // 5. Orçamentos (RLS protegido)
  const budgetMap = new Map<string, any>();
  for (const b of baseState.budgets) {
    budgetMap.set(b.obraId, {
      obra_id: b.obraId,
      valor: b.valor,
      margem: b.margem,
      modo: b.modo,
      linhas: b.linhas,
      source: b.source,
    });
  }
  for (const w of worksFull) {
    if (!budgetMap.has(w.id)) {
      budgetMap.set(w.id, {
        obra_id: w.id,
        valor: 15000,
        margem: 0.2,
        modo: "Simples",
        linhas: [],
        source: "demo",
      });
    }
  }
  const budgetRows = Array.from(budgetMap.values());
  console.log(`⏳ A inserir ${budgetRows.length} orçamentos na tabela 'budgets'...`);
  await batchInsert("budgets", budgetRows, 100, "obra_id");
  console.log(`✅ Tabela 'budgets' preenchida com sucesso! (${budgetRows.length} orçamentos)`);

  // 6. Artigos do inventário (485 linhas reais do PDF de Agosto)
  const articleRows = baseState.articles.map((a) => ({
    id: a.id,
    codigo_acrs: a.codigoACRS,
    familia: a.familia,
    material: a.material,
    tamanho: a.tamanho,
    descricao: a.descricao,
    marca: a.marca,
    quantidade: a.quantidade,
    preco_unitario: a.precoUnitario,
    preco_total: a.precoTotal,
    localizacao: a.localizacao || "ARMAZÉM",
    unidade: a.unidade || "un.",
    precisao: a.precisao || 0,
    minimo: baseState.settings.minimos[a.id] || 0,
    valor_interno: baseState.settings.valoresInternos[a.id] || a.precoUnitario,
    source: a.source,
    source_page: a.sourcePage,
    source_row: a.sourceRow,
  }));
  await batchInsert("articles", articleRows, 100);

  // 7. Colaboradores (TODOS os 201 colaboradores reais do Excel)
  const peopleRows = baseState.people.map((p) => ({
    id: p.id,
    nome: p.nome,
    custo_hora: p.custoHora,
    horas_dia: p.horasDia,
    empresa_id: p.empresaId,
    tipo: p.tipo,
    source: p.source,
  }));
  await batchInsert("people", peopleRows, 100);

  // 8. Máquinas e Equipamentos
  const machineRows = baseState.machines.map((m) => ({
    id: m.id,
    numero: m.numero,
    nome: m.nome,
    marca: m.marca,
    modelo: m.modelo,
    estado: m.estado,
    custo_dia: m.custoDia,
    custo_interno_dia: m.custoInternoDia,
    custo_aquisicao: m.custoAquisicao,
    manutencao_acumulada: m.manutencaoAcumulada || 0,
    tipo: m.tipo,
    source: m.source,
  }));
  await batchInsert("machines", machineRows);

  // 9. Alocações de Equipamentos
  const allocRows = baseState.allocations.map((a) => ({
    id: a.id,
    maquina_id: a.maquinaId,
    obra_id: a.obraId,
    saida: a.saida,
    devolucao: a.devolucao,
    custo_dia: a.custoDia,
    utilizador: a.utilizador,
    registado_em: a.registadoEm,
    source: a.source,
  }));
  await batchInsert("allocations", allocRows);

  // 10. Movimentos de Armazém
  const movementRows = baseState.movements.map((m) => ({
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
  }));
  await batchInsert("movements", movementRows, 100);

  // 11. Faturas (TODAS as 4.243 faturas reais do Excel!)
  const invoiceRows = faturasFull.map((inv: any) => ({
    id: inv.id,
    data: inv.data,
    fornecedor: inv.fornecedor,
    numero: inv.numero || "S/N",
    obra_id: inv.obraId || null,
    categoria: inv.categoria,
    valor: inv.valor,
    cartao: inv.cartao || null,
    estado: "Validada",
    tipo: "Despesa de obra",
    documento_url: null,
    artigo_id: null,
    quantidade: null,
    registado_em: new Date().toISOString(),
    utilizador: "ACRS Importação",
    validado_em: new Date().toISOString(),
    validado_por: "Administração",
    source: "ACRS",
    source_ref: inv.sourceRef || null,
  }));
  await batchInsert("invoices", invoiceRows, 150);

  // 12. Ponto (TODOS os 8.905 registos reais de ponto do Excel!)
  const timeRows = pontoFull.map((t: any) => ({
    id: t.id,
    pessoa_id: t.pessoaId,
    nome: t.nome,
    data: t.data,
    obra_id: t.obraId,
    local: t.local,
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
    registado_em: new Date().toISOString(),
    utilizador: "ACRS Importação",
    source: "ACRS",
    source_ref: t.sourceRef || null,
  }));
  await batchInsert("time_entries", timeRows, 200);

  // 13. Configurações
  await supabase.from("settings").upsert({
    id: "global",
    minimos: baseState.settings.minimos,
    valores_internos: baseState.settings.valoresInternos,
    policy: baseState.settings.policy,
    person_policies: baseState.settings.personPolicies,
    company_policies: baseState.settings.companyPolicies,
    holidays: baseState.settings.holidays,
  });
  console.log("✅ Configurações e políticas inseridas.");

  console.log("🎉 Povoamento INTEGRAL do Supabase concluído com sucesso!");
  console.log(`📊 Totais inseridos:`);
  console.log(`   - Obras: ${workRows.length}`);
  console.log(`   - Colaboradores: ${peopleRows.length}`);
  console.log(`   - Artigos de Inventário: ${articleRows.length}`);
  console.log(`   - Faturas: ${invoiceRows.length}`);
  console.log(`   - Registos de Ponto: ${timeRows.length}`);
  console.log(`   - Máquinas & Equipamentos: ${machineRows.length}`);
}

seed().catch((err) => {
  console.error("❌ Falha no seed:", err);
  process.exit(1);
});
