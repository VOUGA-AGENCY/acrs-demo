import { fetchStateFromSupabase } from "../lib/supabase/service";
import { costLedger, workFinancials } from "../lib/engine";
import { sum } from "../lib/format";
import * as fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [k, ...v] = trimmed.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

async function run() {
  console.log("Fetching state from Supabase using anon key...");
  const t0 = Date.now();
  const st = await fetchStateFromSupabase();
  console.log(`Fetched in ${Date.now() - t0}ms`);
  if (!st) {
    console.log("null state");
    return;
  }
  const ledger = costLedger(st, "2026-09-11");
  console.log(
    "Supabase State: works=",
    st.works.length,
    "budgets=",
    st.budgets.length,
    "invoices=",
    st.invoices.length,
    "times=",
    st.times.length
  );
  console.log("Supabase State: ledger total cost=", sum(ledger, (c) => c.valor));
  const totalBudget = sum(st.budgets, (b) => b.valor);
  console.log("Supabase State: total budget=", totalBudget);

  const active = st.works.filter((w) => w.estado === "Em curso");
  const fin = active.map((w) => workFinancials(st, w.id, ledger));
  console.log("Supabase active works count:", active.length);
  console.log("Supabase active budget sum:", sum(fin, (f) => f.budget));
  console.log("Supabase active cost sum:", sum(fin, (f) => f.cost));
  console.log("Supabase active max sum:", sum(fin, (f) => f.max));

  console.log("\nFirst 5 works in Supabase:");
  st.works.slice(0, 5).forEach((w) => {
    const f = workFinancials(st, w.id, ledger);
    console.log(
      `ID=${w.id} | Nome=${w.nome} | cost=${f.cost.toFixed(2)} | budget=${f.budget} | risk=${f.risk} | consumption=${(
        f.consumption * 100
      ).toFixed(1)}%`
    );
  });

  // Check the 12 demo works from excel-summary.json
  const summary = JSON.parse(fs.readFileSync("./data/source/excel-summary.json", "utf-8"));
  const demoWorkIds: string[] = summary.obraIdsSelecionadas;
  console.log("\nChecking the 12 demo works in Supabase state:");
  demoWorkIds.forEach((id) => {
    const w = st.works.find((x) => x.id === id);
    if (!w) {
      console.log(`❌ Work ${id} NOT found in state.works!`);
    } else {
      const f = workFinancials(st, w.id, ledger);
      console.log(
        `✅ ID=${w.id} | Nome=${w.nome} | cost=${f.cost.toFixed(2)} | budget=${f.budget} | risk=${f.risk} | consumption=${(
          f.consumption * 100
        ).toFixed(1)}%`
      );
    }
  });
}

run();
