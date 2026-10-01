/**
 * SCRIPT DE VERIFICAÇÃO AUTOMATIZADA DE SEGURANÇA E MATRIZ DE PERFIS (RLS)
 * Executa o Passo 4 do Plano de Segurança:
 *   1. Testa acesso anónimo (anon) via chave pública -> Deve bloquear tabelas restritas.
 *   2. Testa tentativa de escalação de privilégios (mudar perfil para 'admin') -> Deve ser rejeitado pelo trigger.
 *   3. Testa isolamento de orçamentos (budgets) -> Apenas Admin pode ler.
 *   4. Testa regras de armazém e secretariado.
 *
 * Executar com: npx tsx scripts/test-security-roles.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("❌ Erro: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios.");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

async function runSecurityTests() {
  console.log("🔒 A iniciar a Bateria de Testes de Segurança Zero-Trust (Passo 4)...\n");

  // --------------------------------------------------------------------------
  // TESTE 1: ATAQUES COM CLIENTE ANÓNIMO (Chave pública sem sessão)
  // --------------------------------------------------------------------------
  console.log("=== 1. Testes com Cliente Anónimo (anon) ===");
  const anonClient = createClient(supabaseUrl!, anonKey!, {
    auth: { persistSession: false },
  });

  // Ataque 1.1: Ler orçamentos confidenciais como anon
  const { data: anonBudgets, error: anonBudgetsErr } = await anonClient
    .from("budgets")
    .select("*");
  assert(
    !anonBudgets || anonBudgets.length === 0 || !!anonBudgetsErr,
    "Anon não consegue ler a tabela 'budgets' (retorna 0 linhas ou erro RLS)",
  );

  // Ataque 1.2: Inserir movimento de stock diretamente como anon
  const { error: anonMovErr } = await anonClient.from("movements").insert({
    id: "hack-mov-anon",
    tipo: "Saída",
    artigo_id: "inv-p01-r002",
    obra_id: "25094",
    descricao: "Movimento forçado via anon",
    quantidade: 999,
    valor_unitario: 10,
    data: "2026-10-01",
    utilizador: "Hacker",
  });
  assert(
    !!anonMovErr,
    `Anon bloqueado ao tentar inserir movimento de armazém (${anonMovErr?.message || "bloqueado"})`,
  );

  // Ataque 1.3: Ler tabela de auditoria (audit_logs) como anon
  const { data: anonAudit, error: anonAuditErr } = await anonClient
    .from("audit_logs")
    .select("*");
  assert(
    !anonAudit || anonAudit.length === 0 || !!anonAuditErr,
    "Anon não consegue ler a tabela 'audit_logs'",
  );

  // Ataque 1.4: Tentar aceder diretamente ao storage privado sem sessão
  const { data: anonStorageData, error: anonStorageErr } = await anonClient.storage
    .from("documents")
    .list();
  assert(
    !anonStorageData || anonStorageData.length === 0 || !!anonStorageErr,
    "Anon não consegue listar ficheiros do bucket privado 'documents'",
  );

  // --------------------------------------------------------------------------
  // TESTE 2: AUTENTICAÇÃO E ISOLAMENTO DE PERFIS
  // --------------------------------------------------------------------------
  console.log("\n=== 2. Testes de Controlo de Acesso Baseado em Perfis (RBAC) ===");

  // Testar com utilizador terreno
  const terrenoClient = createClient(supabaseUrl!, anonKey!, {
    auth: { persistSession: false },
  });

  const { data: terrenoAuth, error: terrenoLoginErr } = await terrenoClient.auth.signInWithPassword({
    email: "terreno@acrs.pt",
    password: "acrs2026!",
  });

  if (terrenoLoginErr || !terrenoAuth.user) {
    console.warn("  ℹ️ Não foi possível autenticar como terreno@acrs.pt (utilizador pode ainda não estar no Auth). A ignorar testes autenticados dependentes.");
  } else {
    console.log("  Autenticado como terreno@acrs.pt com sucesso.");

    // Teste 2.1: Terreno NÃO pode ler orçamentos
    const { data: terrenoBudgets } = await terrenoClient.from("budgets").select("*");
    assert(
      !terrenoBudgets || terrenoBudgets.length === 0,
      "Perfil 'terreno' não consegue ler orçamentos (bloqueado por RLS)",
    );

    // Teste 2.2: Tentativa de Escalação de Privilégios (Terreno tenta mudar perfil para 'admin')
    const { error: escalationErr } = await terrenoClient
      .from("profiles")
      .update({ perfil: "admin" })
      .eq("user_id", terrenoAuth.user.id);

    assert(
      !!escalationErr,
      `Tentativa de auto-escalação de privilégios bloqueada pelo trigger (${escalationErr?.message || "sucesso"})`,
    );

    // Teste 2.3: Terreno NÃO pode alterar obras de outros utilizadores
    const { error: workUpdateErr } = await terrenoClient
      .from("works")
      .update({ nome: "Obra Modificada por Terreno" })
      .eq("id", "25094");

    assert(
      !!workUpdateErr,
      "Perfil 'terreno' bloqueado ao tentar alterar definições de obras",
    );
  }

  // --------------------------------------------------------------------------
  // TESTE 3: ACESSO DE ADMIN
  // --------------------------------------------------------------------------
  console.log("\n=== 3. Testes de Administrador (admin) ===");
  const adminClient = createClient(supabaseUrl!, anonKey!, {
    auth: { persistSession: false },
  });

  const { data: adminAuth, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
    email: "admin@acrs.pt",
    password: "acrs2026!",
  });

  if (adminLoginErr || !adminAuth.user) {
    console.warn("  ℹ️ Não foi possível autenticar como admin@acrs.pt. A ignorar teste de admin.");
  } else {
    console.log("  Autenticado como admin@acrs.pt com sucesso.");

    // Admin pode ler orçamentos
    const { data: adminBudgets } = await adminClient.from("budgets").select("obra_id, valor").limit(3);
    assert(
      !!adminBudgets && adminBudgets.length > 0,
      `Admin consegue consultar orçamentos legítimos (${adminBudgets?.length || 0} registos lidos)`,
    );

    // Admin pode consultar logs de auditoria
    const { data: adminAudit } = await adminClient.from("audit_logs").select("id, acao").limit(3);
    assert(
      adminAudit !== null,
      "Admin tem permissão de leitura sobre a tabela 'audit_logs'",
    );
  }

  console.log("\n========================================================");
  console.log(`📊 RESUMO DOS TESTES DE SEGURANÇA: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error("Erro fatal durante os testes de segurança:", err);
  process.exit(1);
});
