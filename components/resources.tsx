"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Package, Wrench, ArrowLeftRight, TriangleAlert, Calendar } from "lucide-react";
import { useStore } from "./store";
import { stock } from "@/lib/engine";
import { date, includes, money, qty, sum, today } from "@/lib/format";
import { Badge, Button, DetailList, Metric, Modal, PageHeader, Panel, SearchInput, Select, Tabs, Table } from "./ui";
import type { Article } from "@/types/index";

type ArticleRow = {
  id: string;
  code: string;
  name: string;
  detail: string;
  family: string;
  material: string;
  currentStock: number;
  minimumStock: number | null;
  state: "Disponivel" | "Abaixo do minimo" | "Sem stock";
  alert: string;
  location: string;
  unitPrice: number;
  internalValue: number;
  article: Article;
};

export function WarehouseOverview() {
  const { state } = useStore();
  const router = useRouter();
  const active = state.allocations.filter((a) => !a.devolucao);
  const low = state.articles.filter(
    (a) => state.settings.minimos[a.id] != null && stock(state, a.id) < state.settings.minimos[a.id],
  );
  const overdueOrUpcomingInspections = state.machines.filter((m) => {
    if (!m.proximaInspecao) return false;
    const diff = Math.floor(
      (Date.parse(m.proximaInspecao + "T00:00:00Z") -
        Date.parse(today() + "T00:00:00Z")) /
        86400000,
    );
    return diff <= 30;
  });

  return (
    <>
      <PageHeader
        eyebrow="ARMAZEM"
        title="Visao geral"
        description="Gestao integrada de stock de materiais, consumiveis e frota de equipamentos."
        actions={
          <Button onClick={() => router.push("/armazem/tablet")}>
            Abrir tablet <ArrowUpRight size={16} />
          </Button>
        }
      />
      <div className="metrics four">
        <Metric
          label="Recursos em stock"
          value={state.articles.length}
          hint={`${state.articles.filter((a) => stock(state, a.id) > 0).length} com stock`}
          onClick={() => router.push("/armazem/recursos")}
        />
        <Metric
          label="Valor atual do stock"
          value={money(
            sum(
              state.articles,
              (a) => stock(state, a.id) * (state.settings.valoresInternos[a.id] ?? a.precoUnitario),
            ),
          )}
        />
        <Metric
          label="Maquinas em obra"
          value={active.length}
          hint={`${state.machines.length} equipamentos na frota`}
          onClick={() => router.push("/armazem/maquinas")}
        />
        <Metric
          label="Alertas de reposicao"
          value={low.length}
          accent="danger"
          hint={low.length > 0 ? "Abaixo do stock minimo" : "Stock regularizado"}
          onClick={() => router.push("/armazem/recursos?alerta=baixo")}
        />
      </div>
      <div className="grid-two">
        <Panel title="Operacao do armazem" subtitle="Acesso direto aos modulos operacionais">
          <div className="resource-overview">
            <button onClick={() => router.push("/armazem/recursos")}>
              <Package size={20} />
              <div>
                <b>Recursos</b>
                <span>Consultar inventario de consumiveis e materiais</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => router.push("/armazem/maquinas")}>
              <Wrench size={20} />
              <div>
                <b>Maquinas</b>
                <span>Frota, alocacoes a obras e manutencao</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => router.push("/armazem/movimentos")}>
              <ArrowLeftRight size={20} />
              <div>
                <b>Movimentos</b>
                <span>Entradas, saidas e devolucoes</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => router.push("/armazem/tablet")}>
              <Wrench size={20} />
              <div>
                <b>Tablet</b>
                <span>Registar na origem / terreno</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </Panel>
        <Panel title="Atencao necessaria" subtitle="Alertas de stock e manutencoes">
          <div className="resource-overview">
            <button onClick={() => router.push("/armazem/recursos?alerta=baixo")}>
              <TriangleAlert size={20} />
              <div>
                <b>{low.length} artigos</b>
                <span>Abaixo do stock minimo</span>
              </div>
              <Badge tone="amber">Repor</Badge>
            </button>
            <button onClick={() => router.push("/armazem/maquinas?alerta=inspecao")}>
              <Calendar size={20} />
              <div>
                <b>{overdueOrUpcomingInspections.length} equipamentos</b>
                <span>Inspecao periodica pendente ou proxima</span>
              </div>
              <Badge
                tone={
                  overdueOrUpcomingInspections.some(
                    (m) => m.proximaInspecao && m.proximaInspecao < today(),
                  )
                    ? "red"
                    : "amber"
                }
              >
                {overdueOrUpcomingInspections.some(
                  (m) => m.proximaInspecao && m.proximaInspecao < today(),
                )
                  ? "Expirada"
                  : "Inspecionar"}
              </Badge>
            </button>
            <button onClick={() => router.push("/armazem/maquinas")}>
              <Wrench size={20} />
              <div>
                <b>{state.machines.filter((m) => m.estado === "Em reparacao").length} equipamentos</b>
                <span>Em manutencao ou reparacao</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function Resources({ initialType = "Todos", hideCosts = false }: { initialType?: string; hideCosts?: boolean }) {
  const { state } = useStore();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(
    initialType === "Abaixo do minimo" ? "Abaixo do minimo" : "Todos",
  );
  const [familyFilter, setFamilyFilter] = useState("");
  const [q, setQ] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("alerta") === "baixo") setStatusFilter("Abaixo do minimo");
    const requestedId = params.get("id");
    if (requestedId) {
      const art = state.articles.find((a) => a.id === requestedId);
      if (art) setSelectedArticle(art);
    }
  }, [state.articles]);

  const families = useMemo(() => {
    const set = new Set<string>();
    for (const a of state.articles) {
      if (a.familia) set.add(a.familia);
    }
    return Array.from(set).sort();
  }, [state.articles]);

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

  const rows: ArticleRow[] = useMemo(() => {
    return state.articles.map((a) => {
      const available = stock(state, a.id);
      const minimum = state.settings.minimos[a.id] ?? null;
      let stateLabel: ArticleRow["state"] = "Disponivel";
      let alert = "-";
      if (available <= 0) {
        stateLabel = "Sem stock";
        alert = "Sem stock";
      } else if (minimum != null && available < minimum) {
        stateLabel = "Abaixo do minimo";
        alert = "Abaixo do minimo";
      }
      return {
        id: a.id,
        code: a.codigoACRS,
        name: a.descricao,
        detail: [a.marca, a.familia, a.material].filter(Boolean).join(" - "),
        family: a.familia || "Geral",
        material: a.material || "-",
        currentStock: available,
        minimumStock: minimum,
        state: stateLabel,
        alert,
        location: a.localizacao ?? "Por confirmar",
        unitPrice: a.precoUnitario,
        internalValue: state.settings.valoresInternos[a.id] ?? a.precoUnitario,
        article: a,
      };
    });
  }, [state]);

  const filtered = rows.filter((r) => {
    if (statusFilter === "Disponiveis" && r.state !== "Disponivel") return false;
    if (statusFilter === "Abaixo do minimo" && r.state !== "Abaixo do minimo") return false;
    if (statusFilter === "Sem stock" && r.state !== "Sem stock") return false;
    if (familyFilter && r.family !== familyFilter) return false;
    return includes(`${r.code} ${r.name} ${r.detail}`, q);
  });

  return (
    <>
      <PageHeader
        eyebrow="ARMAZEM"
        title="Recursos"
        description="Inventario de consumiveis, materiais, ferragens e artigos de armazem."
        actions={
          <Button onClick={() => router.push("/armazem/tablet")}>
            Registar movimento <ArrowUpRight size={16} />
          </Button>
        }
      />
      <Tabs
        items={["Todos", "Disponiveis", "Abaixo do minimo", "Sem stock"]}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar codigo, artigo, marca ou familia..."
        />
        <Select
          label="Filtrar por familia"
          value={familyFilter}
          onChange={setFamilyFilter}
          placeholder="Todas as familias"
          options={families}
        />
      </div>
      <Table
        rows={filtered}
        rowKey={(r) => r.id}
        onRow={(r) => setSelectedArticle(r.article)}
        columns={[
          { label: "Codigo", render: (r) => <b>{r.code}</b> },
          {
            label: "Artigo / Descricao",
            render: (r) => (
              <div>
                <b>{r.name}</b>
                <small className="block muted">{r.detail}</small>
              </div>
            ),
          },
          {
            label: "Familia",
            render: (r) => <Badge>{r.family}</Badge>,
          },
          {
            label: "Localizacao",
            render: (r) => r.location,
          },
          {
            label: "Stock Disponivel",
            render: (r) => (
              <b style={{ color: r.currentStock <= 0 ? "#dc2626" : undefined }}>
                {qty(r.currentStock, r.article)}
              </b>
            ),
            align: "right",
          },
          {
            label: "Stock Minimo",
            render: (r) =>
              r.minimumStock != null ? qty(r.minimumStock, r.article) : <span className="muted">-</span>,
            align: "right",
          },
          {
            label: "Estado",
            render: (r) => (
              <Badge
                tone={
                  r.state === "Disponivel"
                    ? "green"
                    : r.state === "Abaixo do minimo"
                      ? "amber"
                      : "red"
                }
              >
                {r.state}
              </Badge>
            ),
          },
          ...(!hideCosts
            ? [
                {
                  label: "Preco Compra",
                  render: (r: ArticleRow) => <b>{money(r.unitPrice)}</b>,
                  align: "right" as const,
                },
                {
                  label: "Valor Interno",
                  render: (r: ArticleRow) => (
                    <span className="muted">{money(r.internalValue)}</span>
                  ),
                  align: "right" as const,
                },
              ]
            : []),
        ]}
      />
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
    </>
  );
}
