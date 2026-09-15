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

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAdmin() {
  const t0 = Date.now();
  let invoices: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabaseAdmin.from("invoices").select("*").range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || !data.length) break;
    invoices = invoices.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`✅ Fetched ${invoices.length} invoices in ${Date.now() - t0}ms`);

  let timeEntries: any[] = [];
  page = 0;
  const t1 = Date.now();
  while (true) {
    const { data } = await supabaseAdmin.from("time_entries").select("*").range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || !data.length) break;
    timeEntries = timeEntries.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`✅ Fetched ${timeEntries.length} time entries in ${Date.now() - t1}ms`);

  const { data: profs } = await supabaseAdmin.from("profiles").select("email, user_id, nome, perfil");
  console.log("Perfis registados:", profs);
}

checkAdmin();
