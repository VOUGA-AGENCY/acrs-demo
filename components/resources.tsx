"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Package, Wrench, ArrowLeftRight, TriangleAlert, Calendar } from "lucide-react";
import { useStore } from "./store";
import { days, stock } from "@/lib/engine";
import { date, includes, money, qty, sum, today } from "@/lib/format";
import { Badge, Button, DetailList, Metric, Modal, PageHeader, Panel, SearchInput, Tabs, Table } from "./ui";
import { machineInspectionStatus } from "./machines";
import type { Article, Machine } from "@/types/index";

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

const machineType = (name: string): ResourceRow["type"] =>
  name.toLowerCase().includes("caixa de ferramentas") ? "Ferramentas" : "Máquinas e equipamentos";

export function WarehouseOverview() {
  const { state } = useStore();
  const router = useRouter();
  const active = state.allocations.filter(a => !a.devolucao);
  const low = state.articles.filter(a => state.settings.minimos[a.id] != null && stock(state,a.id) < state.settings.minimos[a.id]);
  const overdueOrUpcomingInspections = state.machines.filter((m) => {
    if (!m.proximaInspecao) return false;
    const diff = Math.floor(
      (Date.parse(m.proximaInspecao + "T00:00:00Z") -
        Date.parse(today() + "T00:00:00Z")) /
        86400000,
    );
    return diff <= 30;
  });
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
          <button onClick={() => router.push("/armazem/maquinas")}><Calendar size={20}/><div><b>{overdueOrUpcomingInspections.length} equipamentos</b><span>Inspeção periódica pendente ou próxima</span></div><Badge tone={overdueOrUpcomingInspections.some(m => m.proximaInspecao && m.proximaInspecao < today()) ? "red" : "amber"}>{overdueOrUpcomingInspections.some(m => m.proximaInspecao && m.proximaInspecao < today()) ? "Expirada" : "Inspecionar"}</Badge></button>
          <button onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}><Wrench size={20}/><div><b>{state.machines.filter(m => m.estado === "Em reparação").length} recursos</b><span>Em manutenção ou reparação</span></div><ArrowUpRight size={16}/></button>
        </div>
      </Panel>
    </div>
  </>;
}

export function Resources({ initialType = "Todos", hideCosts = false }: { initialType?: string; hideCosts?: boolean }) {
  const { state } = useStore();
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedType = params.get("tipo");
    if (requestedType === "Máquinas" || requestedType === "Equipamentos") setType("Máquinas e equipamentos");
    else if (requestedType && ["Consumíveis","Ferramentas","Máquinas e equipamentos"].includes(requestedType)) setType(requestedType);
    if (params.get("alerta") === "baixo") setLowOnly(true);
    const requestedId = params.get("id");
    if (requestedId) {
      const art = state.articles.find((a) => a.id === requestedId);
      if (art) {
        setSelectedArticle(art);
      } else {
        const mac = state.machines.find((m) => m.id === requestedId);
        if (mac) setSelectedMachine(mac);
      }
    }
  }, []);

  const resolveWorkName = (workId?: string | null): string => {
    if (!workId || workId === "Geral" || workId === "-") return "Geral";
    const found = state.works.find((w) => w.id === workId || w.numero === workId);
    if (!found) return workId;
    if (found.nome) {
      return found.numero && found.numero !== found.id
        ? `${found.nome} (${found.numero})`
        : found.nome;
    }
    return found.numero || workId;
  };

  const rows = useMemo<ResourceRow[]>(() => {
    const articles: ResourceRow[] = state.articles.map(a => {
      const available = stock(state,a.id);
      const minimum = state.settings.minimos[a.id];
      const alert = minimum != null && available < minimum ? "Abaixo do mínimo" : "—";
      return {id:a.id,code:a.codigoACRS,name:a.descricao,detail:[a.marca,a.familia].filter(Boolean).join(" · "),type:"Consumíveis",state:available > 0 ? "Disponível" : "Sem stock",alert,location:a.localizacao ?? "Por confirmar",rule:`${qty(1,a)} × valor interno`,value:qty(available,a)};
    });
    const machines: ResourceRow[] = state.machines.map(m => {
      const allocation = state.allocations.find(a => a.maquinaId === m.id && !a.devolucao);
      let alert = "—";
      if (m.proximaInspecao) {
        if (m.proximaInspecao < today()) {
          alert = "Inspeção expirada";
        } else {
          const diff = Math.floor(
            (Date.parse(m.proximaInspecao + "T00:00:00Z") -
              Date.parse(today() + "T00:00:00Z")) /
              86400000,
          );
          if (diff <= 30) alert = `Inspeção em ${diff}d`;
        }
      }
      return {
        id: m.id,
        code: m.numero,
        name: m.nome,
        detail: [m.marca, m.modelo].filter(Boolean).join(" · "),
        type: machineType(m.nome),
        state: allocation ? "Em obra" : m.estado,
        alert,
        location: allocation ? resolveWorkName(allocation.obraId) : "Armazém",
        rule: "N.º de dias × custo diário",
        value: `${money(m.custoDia)} / dia`,
      };
    });
    return [...articles,...machines];
  },[state]);

  const filtered = rows.filter(r => (type === "Todos" || r.type === type) && (!lowOnly || r.alert !== "—") && includes(`${r.code} ${r.name} ${r.detail}`, q));

  return <>
    <PageHeader eyebrow="ARMAZÉM" title="Recursos" description="Uma lista para tudo o que entra, sai, regressa ou é atribuído a uma obra." actions={<Button onClick={() => router.push("/armazem/tablet")}>Registar movimento <ArrowUpRight size={16}/></Button>}/>
    <Tabs
      items={["Todos", "Consumíveis", "Ferramentas", "Máquinas e equipamentos"]}
      value={type}
      onChange={(t) => setType(t)}
    />
    <div className="filter-bar"><SearchInput value={q} onChange={setQ} placeholder="Pesquisar código, recurso, marca ou família…"/><Button secondary onClick={() => setLowOnly(!lowOnly)}>{lowOnly ? "Ver todos os recursos" : "Só abaixo do mínimo"}</Button></div>
    <Table
      rows={filtered}
      rowKey={(r) => `${r.type}-${r.id}`}
      onRow={(r) => {
        if (r.type === "Consumíveis") {
          const found = state.articles.find((a) => a.id === r.id);
          if (found) setSelectedArticle(found);
        } else {
          const found = state.machines.find((m) => m.id === r.id);
          if (found) setSelectedMachine(found);
        }
      }}
      columns={[
      {label:"Referência",render:r => <b>{r.code}</b>},
      {label:"Recurso",render:r => <div><b>{r.name}</b><small className="block muted">{r.detail}</small></div>},
      {label:"Tipo",render:r => <Badge>{{Consumíveis:"Consumível",Ferramentas:"Ferramenta","Máquinas e equipamentos":"Máquina/equipamento"}[r.type]}</Badge>},
      {label:"Estado",render:r => <Badge>{r.state}</Badge>},
      {label:"Alerta",render:r => r.alert === "—" ? <span className="muted">—</span> : <Badge tone="amber">{r.alert}</Badge>},
      {label:"Localização / obra",render:r => r.location},
      ...(!hideCosts ? [
        {label:"Regra de custo",render:(r: ResourceRow) => <span className="muted">{r.rule}</span>},
        {label:"Disponibilidade / tarifa",render:(r: ResourceRow) => <b>{r.value}</b>,align:"right" as const},
      ] : []),
    ]}/>
    {selectedArticle && (
      <Modal
        title={selectedArticle.descricao}
        drawer
        onClose={() => setSelectedArticle(null)}
      >
        <div className="drawer-body">
          <div className="detail-hero">
            <Badge tone={stock(state, selectedArticle.id) > 0 ? "green" : "red"}>
              {stock(state, selectedArticle.id) > 0 ? "Disponivel" : "Sem stock"}
            </Badge>
            <h3>{selectedArticle.codigoACRS}</h3>
            <p className="muted">
              {[selectedArticle.marca, selectedArticle.familia].filter(Boolean).join(" - ")}
            </p>
          </div>
          <DetailList
            items={[
              ["Codigo ACRS", <b>{selectedArticle.codigoACRS}</b>],
              ["Descricao", selectedArticle.descricao],
              ["Familia", selectedArticle.familia],
              ["Material", selectedArticle.material || "-"],
              ["Dimensoes / Tamanho", selectedArticle.tamanho || "-"],
              ["Marca", selectedArticle.marca || "-"],
              ["Localizacao no armazem", selectedArticle.localizacao || "Por confirmar"],
              ["Stock disponivel", <b>{qty(stock(state, selectedArticle.id), selectedArticle)}</b>],
              [
                "Stock minimo",
                state.settings.minimos[selectedArticle.id] != null
                  ? qty(state.settings.minimos[selectedArticle.id], selectedArticle)
                  : "Nao definido",
              ],
              ...(!hideCosts
                ? ([
                    ["Preco unitario compra", money(selectedArticle.precoUnitario)],
                    [
                      "Valor interno aplicado",
                      money(state.settings.valoresInternos[selectedArticle.id] ?? selectedArticle.precoUnitario),
                    ],
                    [
                      "Valor total em stock",
                      money(
                        stock(state, selectedArticle.id) *
                          (state.settings.valoresInternos[selectedArticle.id] ?? selectedArticle.precoUnitario),
                      ),
                    ],
                  ] as [string, React.ReactNode][])
                : []),
              ["Unidade", selectedArticle.unidade || "un"],
              ["Origem do registo", selectedArticle.source === "ACRS" ? "Catalogo ACRS" : "Demonstracao"],
            ]}
          />
          <div className="machine-actions">
            <Button onClick={() => router.push("/armazem/tablet")}>
              Registar no tablet <ArrowUpRight size={16} />
            </Button>
            <Button secondary onClick={() => router.push("/armazem/movimentos")}>
              Ver movimentos <ArrowLeftRight size={16} />
            </Button>
          </div>
          <h3 className="small-title">Ultimos movimentos deste material</h3>
          {state.movements.filter((m) => m.artigoId === selectedArticle.id).length === 0 ? (
            <p className="footnote muted">Sem movimentos registados para este artigo.</p>
          ) : (
            state.movements
              .filter((m) => m.artigoId === selectedArticle.id)
              .slice(0, 5)
              .map((m) => (
                <div key={m.id} className="history-card">
                  <b>{m.tipo} - {resolveWorkName(m.obraId)}</b>
                  <span>
                    Data: {date(m.data)} | Quantidade: {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade} {selectedArticle.unidade || "un"}
                  </span>
                  <span>
                    Utilizador: {m.utilizador || "Armazem"}{!hideCosts ? ` | Custo: ${money(m.valorUnitario)}` : ""}
                  </span>
                </div>
              ))
          )}
        </div>
      </Modal>
    )}
    {selectedMachine && (() => {
      const activeAllocation = state.allocations.find((a) => a.maquinaId === selectedMachine.id && !a.devolucao);
      const insp = machineInspectionStatus(selectedMachine);
      return (
        <Modal
          title={selectedMachine.nome}
          drawer
          onClose={() => setSelectedMachine(null)}
        >
          <div className="drawer-body">
            <div className="detail-hero">
              <Badge tone={activeAllocation ? "amber" : selectedMachine.estado === "Disponivel" ? "green" : "neutral"}>
                {activeAllocation ? "Em obra" : selectedMachine.estado}
              </Badge>
              <h3>{selectedMachine.numero}</h3>
              <p className="muted">
                {[selectedMachine.marca, selectedMachine.modelo].filter(Boolean).join(" - ")}
              </p>
            </div>
            <DetailList
              items={[
                ["N. Identificacao", <b>{selectedMachine.numero}</b>],
                ["Nome", selectedMachine.nome],
                ["Tipo", selectedMachine.tipo],
                ["Marca / Modelo", [selectedMachine.marca, selectedMachine.modelo].filter(Boolean).join(" / ") || "-"],
                [
                  "Localizacao atual",
                  activeAllocation
                    ? resolveWorkName(activeAllocation.obraId)
                    : selectedMachine.estado === "Em reparacao"
                      ? "Em reparacao"
                      : "Armazem central",
                ],
                [
                  "Obra atual",
                  activeAllocation ? resolveWorkName(activeAllocation.obraId) : "-",
                ],
                [
                  "Data de saida",
                  activeAllocation ? date(activeAllocation.saida) : "-",
                ],
                [
                  "Dias em obra",
                  activeAllocation ? `${days(activeAllocation)} dias` : "-",
                ],
                ...(!hideCosts
                  ? ([
                      ["Tarifa diaria a obra", `${money(activeAllocation?.custoDia ?? selectedMachine.custoDia)} / dia`],
                      [
                        "Tarifa interna (amortizacao)",
                        selectedMachine.custoInternoDia != null
                          ? `${money(selectedMachine.custoInternoDia)} / dia`
                          : "-",
                      ],
                      [
                        "Custo de aquisicao",
                        selectedMachine.custoAquisicao ? money(selectedMachine.custoAquisicao) : "-",
                      ],
                      [
                        "Data de aquisicao",
                        selectedMachine.dataAquisicao ? date(selectedMachine.dataAquisicao) : "-",
                      ],
                      [
                        "Periodo de amortizacao",
                        selectedMachine.periodoAmortizacao
                          ? `${selectedMachine.periodoAmortizacao} anos`
                          : "-",
                      ],
                      [
                        "Total faturado acumulado",
                        money(
                          sum(
                            state.allocations.filter((a) => a.maquinaId === selectedMachine.id),
                            (a) => days(a) * a.custoDia,
                          ),
                        ),
                      ],
                    ] as [string, React.ReactNode][])
                  : []),
                [
                  "Inspecao periodica",
                  insp.tone ? <Badge tone={insp.tone}>{insp.label}</Badge> : insp.label,
                ],
                [
                  "Periodicidade de inspecao",
                  selectedMachine.periodicidadeInspecao
                    ? `${selectedMachine.periodicidadeInspecao} meses`
                    : "12 meses (predefinido)",
                ],
                [
                  "Ultima inspecao",
                  selectedMachine.ultimaInspecao ? date(selectedMachine.ultimaInspecao) : "Sem registo",
                ],
                [
                  "Proxima inspecao",
                  selectedMachine.proximaInspecao ? date(selectedMachine.proximaInspecao) : "Nao agendada",
                ],
              ]}
            />
            <div className="machine-actions">
              <Button onClick={() => router.push(`/armazem/maquinas?id=${selectedMachine.id}`)}>
                Gerir equipamento <ArrowUpRight size={16} />
              </Button>
              <Button secondary onClick={() => router.push("/armazem/tablet")}>
                Registar no tablet <Wrench size={16} />
              </Button>
            </div>
            <h3 className="small-title">Historico de alocacoes</h3>
            {state.allocations.filter((a) => a.maquinaId === selectedMachine.id).length === 0 ? (
              <p className="footnote muted">Sem alocacoes registadas para este equipamento.</p>
            ) : (
              state.allocations
                .filter((a) => a.maquinaId === selectedMachine.id)
                .slice(0, 5)
                .map((a) => (
                  <div key={a.id} className="history-card">
                    <b>{resolveWorkName(a.obraId)}</b>
                    <span>
                      {date(a.saida)} {"->"} {a.devolucao ? date(a.devolucao) : "Em curso"}
                    </span>
                    <span>
                      {days(a)} dias x {money(a.custoDia)} = {money(days(a) * a.custoDia)}
                    </span>
                  </div>
                ))
            )}
          </div>
        </Modal>
      );
    })()}
  </>;
}
