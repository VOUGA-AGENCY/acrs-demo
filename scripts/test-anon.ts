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

async function testAnon() {
  const tables = [
    "works",
    "budgets",
    "articles",
    "people",
    "companies",
    "time_entries",
    "invoices",
    "movements",
    "machines",
    "allocations",
    "settings",
  ];
  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select("*", { count: "exact" }).limit(5);
    if (error) {
      console.log(`❌ ${t}: ERROR ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ ${t}: count=${count}, sample returned=${data?.length}`);
    }
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const adminBudgets = await admin.from("budgets").select("*", { count: "exact" });
  console.log(`🔑 ADMIN budgets count=${adminBudgets.count}, error=${adminBudgets.error?.message}`);

  const { data: invMin } = await admin.from("invoices").select("data").order("data", { ascending: true }).limit(1);
  const { data: invMax } = await admin.from("invoices").select("data").order("data", { ascending: false }).limit(1);
  const { data: timeMin } = await admin.from("time_entries").select("data").order("data", { ascending: true }).limit(1);
  const { data: timeMax } = await admin.from("time_entries").select("data").order("data", { ascending: false }).limit(1);
  console.log("Invoices date range:", invMin?.[0]?.data, "to", invMax?.[0]?.data);
  console.log("Time date range:", timeMin?.[0]?.data, "to", timeMax?.[0]?.data);
}

testAnon();
