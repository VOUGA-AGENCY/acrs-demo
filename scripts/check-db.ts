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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: works, error: wErr } = await supabase.from("works").select("id, numero, nome");
  const { data: budgets, error: bErr } = await supabase.from("budgets").select("*");
  const { data: invoices, error: iErr } = await supabase.from("invoices").select("id, valor, estado, tipo");
  const { data: time_entries, error: tErr } = await supabase.from("time_entries").select("id");
  const { data: articles, error: aErr } = await supabase.from("articles").select("id");

  console.log("Works:", works?.length, "error:", wErr?.message);
  console.log("Budgets:", budgets?.length, "error:", bErr?.message);
  console.log("Invoices:", invoices?.length, "error:", iErr?.message);
  console.log("Time entries:", time_entries?.length, "error:", tErr?.message);
  console.log("Articles:", articles?.length, "error:", aErr?.message);
}

check();
