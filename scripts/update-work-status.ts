import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

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
const summary = JSON.parse(fs.readFileSync("./data/source/excel-summary.json", "utf-8"));
const selectedActiveIds = new Set(summary.obraIdsSelecionadas.filter((id: string) => id !== "25061")); // 25061 é histórica/concluída

async function updateWorkStatuses() {
  console.log("A atualizar estados das obras no Supabase...");
  
  // Obter todas as obras
  const { data: works, error } = await admin.from("works").select("id, nome");
  if (error || !works) {
    console.error("Erro ao ler obras:", error);
    return;
  }

  let inProgressCount = 0;
  let completedCount = 0;

  for (const w of works) {
    const isActive = selectedActiveIds.has(w.id);
    const estado = isActive ? "Em curso" : "Concluída";
    if (isActive) inProgressCount++;
    else completedCount++;

    await admin.from("works").update({ estado }).eq("id", w.id);
  }

  console.log(`✅ Concluído! Obras em curso: ${inProgressCount} | Obras concluídas: ${completedCount} (Total: ${works.length})`);
}

updateWorkStatuses();
