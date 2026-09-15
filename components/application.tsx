"use client";
import { Dashboard } from "./dashboard";
import { Works, WorkDetail } from "./works";
import { Shell } from "./shell";
import { PageHeader } from "./ui";
import { Movements, Tablet } from "./warehouse";
import { Invoices, FieldPage } from "./invoices";
import { People, Point, Companies } from "./people";
import { Budgets } from "./budgets";
import { Control } from "./control";
import { Settings } from "./settings";
import { Resources, WarehouseOverview } from "./resources";
import { useStore } from "./store";
export function Application({ segments = [] }: { segments?: string[] }) {
  const path = segments.join("/");
  const { profile, isLoaded } = useStore();
  const switchingProfile =
    (profile === "Campo" && path !== "campo") ||
    (profile === "Armazém" && path !== "armazem/tablet");
  const routes: Record<string, React.ReactNode> = {
    "": <Dashboard />,
    obras: <Works />,
    "armazem": <WarehouseOverview />,
    "armazem/recursos": <Resources />,
    "armazem/stock": <Resources initialType="Consumíveis" />,
    "armazem/movimentos": <Movements />,
    "armazem/consumo": <Control initialTab="Consumo de stock" />,
    "armazem/maquinas": <Resources initialType="Máquinas e equipamentos" />,
    "armazem/tablet": <Tablet />,
    faturas: <Invoices />,
    "pessoas/ponto": <Point />,
    "pessoas/colaboradores": <People />,
    "pessoas/empresas": <Companies />,
    orcamentos: <Budgets />,
    controlo: <Control />,
    configuracao: <Settings />,
    campo: <FieldPage />,
  };
  return (
    <Shell>
      {!isLoaded ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "360px", gap: "16px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#1e3a8a", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#64748b", fontSize: "14px" }}>A sincronizar base de dados ACRS...</p>
        </div>
      ) : switchingProfile ? (
        <p role="status">A abrir a área de {profile.toLowerCase()}…</p>
      ) : profile === "Campo" ? (
        <FieldPage />
      ) : profile === "Armazém" ? (
        <Tablet />
      ) : segments[0] === "obras" && segments[1] ? (
        <WorkDetail id={segments[1]} />
      ) : (
        (routes[path] ?? (
          <PageHeader
            title="Página não encontrada"
            description="Utilize o menu para regressar à operação."
          />
        ))
      )}
    </Shell>
  );
}
