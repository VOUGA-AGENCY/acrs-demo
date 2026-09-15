"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Package, Wrench, ArrowLeftRight, TriangleAlert } from "lucide-react";
import { useStore } from "./store";
import { stock } from "@/lib/engine";
import { money, qty, sum } from "@/lib/format";
import { Badge, Button, Metric, PageHeader, Panel, SearchInput, Tabs, Table } from "./ui";

type ResourceRow = {
  id: string;
  code: string;
  name: string;
  detail: string;
  type: "Consumíveis" | "Ferramentas" | "Máquinas e equipamentos";
  state: string;
  alert: string;
  location: string;
  rule: string;
  value: string;
};
const resourceTypeLabels: Record<ResourceRow["type"], string> = {
  Consumíveis: "Consumível",
  Ferramentas: "Ferramenta",
  "Máquinas e equipamentos": "Máquina/equipamento",
};

const machineType = (name: string): ResourceRow["type"] =>
  name.toLowerCase().includes("caixa de ferramentas") ? "Ferramentas" : "Máquinas e equipamentos";

export function WarehouseOverview() {
  const { state } = useStore();
  const router = useRouter();
  const active = state.allocations.filter(a => !a.devolucao);
  const low = state.articles.filter(a => state.settings.minimos[a.id] != null && stock(state,a.id) < state.settings.minimos[a.id]);
  return <>
    <PageHeader eyebrow="ARMAZÉM" title="Visão geral" description="Materiais, ferramentas, máquinas e equipamentos numa única operação." actions={<Button onClick={() => router.push("/armazem/tablet")}>Abrir tablet <ArrowUpRight size={16}/></Button>}/>
    <div className="metrics four">
      <Metric label="Recursos registados" value={state.articles.length+state.machines.length} onClick={() => router.push("/armazem/recursos")}/>
      <Metric label="Valor atual do stock" value={money(sum(state.articles,a => stock(state,a.id)*(state.settings.valoresInternos[a.id] ?? a.precoUnitario)))}/>
      <Metric label="Máquinas e equipamentos em obra" value={active.length} onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}/>
      <Metric label="Alertas de reposição" value={low.length} accent="danger" onClick={() => router.push("/armazem/recursos?alerta=baixo")}/>
    </div>
    <div className="grid-two">
      <Panel title="Operação do armazém" subtitle="Um ponto de entrada para todos os movimentos">
        <div className="resource-overview">
          <button onClick={() => router.push("/armazem/recursos")}><Package size={20}/><div><b>Recursos</b><span>Consultar disponibilidade e localização</span></div><ArrowUpRight size={16}/></button>
          <button onClick={() => router.push("/armazem/movimentos")}><ArrowLeftRight size={20}/><div><b>Movimentos</b><span>Entradas, saídas e devoluções</span></div><ArrowUpRight size={16}/></button>
          <button onClick={() => router.push("/armazem/tablet")}><Wrench size={20}/><div><b>Tablet</b><span>Registar na origem</span></div><ArrowUpRight size={16}/></button>
        </div>
      </Panel>
      <Panel title="Atenção necessária" subtitle="Alertas separados do estado operacional">
        <div className="resource-overview">
          <button onClick={() => router.push("/armazem/recursos?alerta=baixo")}><TriangleAlert size={20}/><div><b>{low.length} artigos</b><span>Abaixo do stock mínimo</span></div><Badge tone="amber">Repor</Badge></button>
          <button onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}><Wrench size={20}/><div><b>{state.machines.filter(m => m.estado === "Em reparação").length} recursos</b><span>Em manutenção ou reparação</span></div><ArrowUpRight size={16}/></button>
        </div>
      </Panel>
    </div>
  </>;
}

export function Resources({
  initialType = "Todos",
  hideFinancials = false,
}: {
  initialType?: string;
  hideFinancials?: boolean;
}) {
  const { state } = useStore();
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedType = params.get("tipo");
    if (requestedType === "Máquinas" || requestedType === "Equipamentos") setType("Máquinas e equipamentos");
    else if (requestedType && ["Consumíveis","Ferramentas","Máquinas e equipamentos"].includes(requestedType)) setType(requestedType);
    if (params.get("alerta") === "baixo") setLowOnly(true);
  }, []);
  const rows = useMemo<ResourceRow[]>(() => {
    const articles: ResourceRow[] = state.articles.map(a => {
      const available = stock(state,a.id);
      const minimum = state.settings.minimos[a.id];
      const alert = minimum != null && available < minimum ? "Abaixo do mínimo" : "—";
      return {id:a.id,code:a.codigoACRS,name:a.descricao,detail:[a.marca,a.familia].filter(Boolean).join(" · "),type:"Consumíveis",state:available > 0 ? "Disponível" : "Sem stock",alert,location:a.localizacao ?? "Por confirmar",rule:`${qty(1,a)} × valor interno`,value:qty(available,a)};
    });
    const machines: ResourceRow[] = state.machines.map(m => {
      const allocation = state.allocations.find(a => a.maquinaId === m.id && !a.devolucao);
      return {id:m.id,code:m.numero,name:m.nome,detail:[m.marca,m.modelo].filter(Boolean).join(" · "),type:machineType(m.nome),state:allocation ? "Em obra" : m.estado,alert:"—",location:allocation ? `Obra ${allocation.obraId}` : "Armazém",rule:"N.º de dias × custo diário",value:`${money(m.custoDia)} / dia`};
    });
    return [...articles,...machines];
  },[state]);
  const filtered = rows.filter(r => (type === "Todos" || r.type === type) && (!lowOnly || r.alert !== "—") && `${r.code} ${r.name} ${r.detail}`.toLowerCase().includes(q.toLowerCase()));
  return <>
    <PageHeader eyebrow="ARMAZÉM" title="Recursos" description="Uma lista para tudo o que entra, sai, regressa ou é atribuído a uma obra." actions={<Button onClick={() => router.push("/armazem/tablet")}>Registar movimento <ArrowUpRight size={16}/></Button>}/>
    <Tabs items={["Todos","Consumíveis","Ferramentas","Máquinas e equipamentos"]} value={type} onChange={setType}/>
    <div className="filter-bar"><SearchInput value={q} onChange={setQ} placeholder="Pesquisar código, recurso, marca ou família…"/><Button secondary onClick={() => setLowOnly(!lowOnly)}>{lowOnly ? "Ver todos os recursos" : "Só abaixo do mínimo"}</Button></div>
    <Table rows={filtered} columns={[
      {label:"Referência",render:r => <b>{r.code}</b>},
      {label:"Recurso",render:r => <div><b>{r.name}</b><small className="block muted">{r.detail}</small></div>},
      {label:"Tipo",render:r => <Badge>{resourceTypeLabels[r.type]}</Badge>},
      {label:"Estado",render:r => <Badge>{r.state}</Badge>},
      {label:"Alerta",render:r => r.alert === "—" ? <span className="muted">—</span> : <Badge tone="amber">{r.alert}</Badge>},
      {label:"Localização / obra",render:r => r.location},
      ...(!hideFinancials ? [{label:"Regra de custo",render:(r: ResourceRow) => <span className="muted">{r.rule}</span>}] : []),
      {label:hideFinancials ? "Disponibilidade" : "Disponibilidade / tarifa",render:r => <b>{hideFinancials && r.type === "Máquinas e equipamentos" ? "Disponível" : r.value}</b>,align:"right"},
    ]}/>
  </>;
}
