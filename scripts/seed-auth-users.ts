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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Erro: Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ficheiro .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
  {
    email: "admin@acrs.pt",
    password: "acrs2026!",
    nome: "João Catalão",
    perfil: "admin",
    avatar: "JC",
  },
  {
    email: "secretariado@acrs.pt",
    password: "acrs2026!",
    nome: "Vítor",
    perfil: "secretariado",
    avatar: "VI",
  },
  {
    email: "armazem@acrs.pt",
    password: "acrs2026!",
    nome: "Armazém Central",
    perfil: "armazem",
    avatar: "AR",
  },
  {
    email: "terreno@acrs.pt",
    password: "acrs2026!",
    nome: "Equipa de Campo",
    perfil: "terreno",
    avatar: "CA",
  },
];

async function seedAuthUsers() {
  console.log("🚀 A criar/atualizar utilizadores no Supabase Auth...");

  const { data: existingUsersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Erro ao listar utilizadores do Supabase Auth:", listError.message);
    throw listError;
  }

  const existingMap = new Map(existingUsersData.users.map((u) => [u.email?.toLowerCase(), u]));

  for (const u of DEMO_USERS) {
    let authUserId: string;
    const existing = existingMap.get(u.email.toLowerCase());

    if (existing) {
      console.log(`ℹ️ Utilizador ${u.email} já existe (${existing.id}), a atualizar password e confirmação...`);
      const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: u.password,
        email_confirm: true,
        user_metadata: { nome: u.nome, perfil: u.perfil },
      });
      if (updateErr) {
        console.error(`❌ Erro ao atualizar ${u.email}:`, updateErr.message);
        throw updateErr;
      }
      authUserId = updated.user.id;
    } else {
      console.log(`⏳ A criar utilizador ${u.email}...`);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { nome: u.nome, perfil: u.perfil },
      });
      if (createErr) {
        console.error(`❌ Erro ao criar ${u.email}:`, createErr.message);
        throw createErr;
      }
      authUserId = created.user.id;
    }

    // Associar user_id no registo de profiles
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        email: u.email,
        user_id: authUserId,
        nome: u.nome,
        perfil: u.perfil,
        avatar: u.avatar,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    if (profileError) {
      console.error(`❌ Erro ao atualizar perfil ${u.email}:`, profileError.message);
      throw profileError;
    }

    console.log(`✅ Utilizador ${u.email} [${u.perfil}] associado com sucesso (Auth ID: ${authUserId})`);
  }

  console.log("🎉 Todos os utilizadores de demonstração estão prontos e associados ao Supabase Auth!");
}

seedAuthUsers().catch((err) => {
  console.error("Falha:", err);
  process.exit(1);
});
