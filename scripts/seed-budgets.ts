import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { initialState } from "../lib/initial";

const envContent = fs.readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [k, ...v] = trimmed.split("=");
    if (k && v.length) env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const worksFull = JSON.parse(fs.readFileSync("./data/source/obras-full.json", "utf-8"));
const baseState = initialState();

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

const rows = Array.from(budgetMap.values());

async function run() {
  const { data, error } = await admin.from("budgets").upsert(rows, { onConflict: "obra_id" });
  console.log("✅ Upserted 240 budgets into Supabase:", { count: rows.length, error: error?.message });
}

run();
