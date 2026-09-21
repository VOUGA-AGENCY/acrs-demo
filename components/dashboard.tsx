"use client";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  FileText,
  Clock3,
  TriangleAlert,
  Package,
  Wrench,
  Users,
} from "lucide-react";
import { useStore } from "./store";
import { WorkTable } from "./works";
import { Badge, Button, Metric, PageHeader, Panel, Table } from "./ui";
import { money, num, sum, date } from "@/lib/format";
import { stock, workFinancials } from "@/lib/engine";
import { CostBreakdown } from "./costs";
export function Dashboard() {
  const { state, ledger, profile } = useStore();
  const router = useRouter();
  const operational = profile === "Vítor";
  const management = profile === "Gerência";
  const john = profile === "João Catalão";
  const totalCost = sum(ledger, (c) => c.valor);
  const totalBudget = sum(state.budgets, (b) => b.valor);
  const active = state.works.filter((w) => w.estado === "Em curso");
  const activeFinancials = active.map((work) => ({
    work,
    financials: workFinancials(state, work.id, ledger),
  }));
  const activeWorkValue = sum(activeFinancials, ({ financials }) => financials.budget);
  const activeCostMax = sum(activeFinancials, ({ financials }) => financials.max);
  const activeCost = sum(activeFinancials, ({ financials }) => financials.cost);
  const risks = state.works.filter(
    (w) => workFinancials(state, w.id, ledger).risk === "Em risco",
  );
  const activeRisks = activeFinancials.filter(
    ({ financials }) => financials.risk === "Em risco",
  );
  const attention = active
    .filter((w) => workFinancials(state, w.id, ledger).consumption >= 0.7)
    .sort(
      (a, b) =>
        workFinancials(state, b.id, ledger).consumption -
        workFinancials(state, a.id, ledger).consumption,
    );
  const low = state.articles.filter(
    (a) =>
      state.settings.minimos[a.id] != null &&
      stock(state, a.id) < state.settings.minimos[a.id],
  );
  const open = state.allocations.filter((a) => !a.devolucao);
  const available = state.machines.filter(
    (m) => m.estado === "Disponível" && !open.some((a) => a.maquinaId === m.id),
  );
  const stockValue = sum(
    state.articles,
    (article) =>
      stock(state, article.id) *
      (state.settings.valoresInternos[article.id] ?? article.precoUnitario),
  );
  const alertReason = (workId: string) => {
    const financials = workFinancials(state, workId, ledger);
    if (financials.cost > financials.max)
      return `Custo máximo excedido em ${money(financials.cost - financials.max)}`;
    if (financials.margin < financials.target) return "Margem abaixo do objetivo";
    return `${num(financials.consumption * 100, 0)}% do custo máximo utilizado`;
  };
  return (
    <>
      <PageHeader
        eyebrow="VISÃO GERAL"
        title={
          operational
            ? "A operação, num só lugar."
            : management
              ? "Visão de gestão"
              : "Bom dia, João."
        }
        description={
          operational
            ? "Obras, pessoas e recursos. Tudo ligado."
            : management
              ? "Custos, margem e atenção às obras."
              : "O essencial para acompanhar a operação da ACRS."
        }
        actions={
          <>
            <div className="date-chip">
              <Clock3 size={15} />
              <span>{date(new Date().toISOString())}</span>
            </div>
            {operational && (
              <Button onClick={() => router.push("/armazem/tablet")}>
                Registar movimento <ArrowUpRight size={16} />
              </Button>
            )}
          </>
        }
      />
      {operational ? (
        <div className="metrics six">
          <Metric
            label="Obras em curso"
            value={active.length}
            icon={<Building2 size={18} />}
          />
          <Metric
            label="Pessoas com registos"
            value={new Set(state.times.map((t) => t.pessoaId)).size}
            hint="Histórico selecionado"
            icon={<Users size={18} />}
          />
          <Metric
            label="Máquinas em obra"
            value={open.length}
            onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}
          />
          <Metric
            label="Disponíveis"
            value={available.length}
            accent="positive"
            onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}
          />
          <Metric
            label="Em reparação"
            value={
              state.machines.filter((m) => m.estado === "Em reparação").length
            }
            onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}
          />
          <Metric
            label="Abaixo do mínimo"
            value={low.length}
            accent="danger"
            onClick={() => router.push("/armazem/recursos?alerta=baixo")}
          />
        </div>
      ) : john ? (
        <div className="metrics four">
          <Metric
            label="Valor total orçamentado das obras ativas"
            value={money(activeWorkValue)}
            hint={`${active.length} obras em curso`}
            icon={<Building2 size={18} />}
            onClick={() => router.push("/obras")}
          />
          <Metric
            label="Custo máximo agregado"
            value={money(activeCostMax)}
            hint="Limite para manter a margem alvo"
            icon={<FileText size={18} />}
            onClick={() => router.push("/orcamentos")}
          />
          <Metric
            label="Custo atual"
            value={money(activeCost)}
            hint="Custos registados nas obras em curso"
            icon={<Clock3 size={18} />}
            accent="orange"
            onClick={() => router.push("/controlo")}
          />
          <Metric
            label="Obras em risco"
            value={activeRisks.length}
            hint="A aproximar-se do custo máximo"
            icon={<TriangleAlert size={18} />}
            accent="danger"
            onClick={() => router.push("/controlo")}
          />
        </div>
      ) : (
        <div className="metrics four">
          <Metric
            label="Obras ativas"
            value={active.length}
            hint={`${state.works.length} obras no cenário`}
            icon={<Building2 size={18} />}
            onClick={() => router.push("/obras")}
          />
          <Metric
            label="Valor orçamentado"
            value={money(totalBudget)}
            hint="Orçamentos demonstrativos"
            icon={<FileText size={18} />}
            onClick={() => router.push("/orcamentos")}
          />
          <Metric
            label="Custo acumulado"
            value={money(totalCost)}
            hint="Histórico + registos da sessão"
            icon={<Clock3 size={18} />}
            accent="orange"
            onClick={() => router.push("/controlo")}
          />
          <Metric
            label="Margem agregada"
            value={`${num(((totalBudget - totalCost) / totalBudget) * 100)}%`}
            hint="Sobre custos registados"
            icon={<TriangleAlert size={18} />}
            accent="positive"
            onClick={() => router.push("/controlo")}
          />
        </div>
      )}
      {john && (
        <div className="dashboard-quick-actions">
          <Button secondary onClick={() => router.push("/pessoas/ponto")}>
            <Clock3 size={16} /> Registar ponto
          </Button>
          <Button onClick={() => router.push("/faturas")}>
            <FileText size={16} /> Adicionar fatura
          </Button>
        </div>
      )}
      <div className="section-top">
        <div>
          <h2>
            {operational ? "Obras em curso" : "Obras que requerem atenção"}
          </h2>
          <p>
            {operational
              ? "Recursos e execução no terreno."
              : "Acompanhe o consumo antes de comprometer a margem."}
          </p>
        </div>
        <button className="text-button" onClick={() => router.push("/obras")}>
          Ver todas as obras <ArrowUpRight size={16} />
        </button>
      </div>
      {operational ? (
        <Table
          rows={active.slice(0, 6)}
          onRow={(w) => router.push(`/obras/${w.id}`)}
          columns={[
            {
              label: "Obra",
              render: (w) => (
                <b>
                  {w.numero} · {w.nome}
                </b>
              ),
            },
            {
              label: "Pessoas no histórico",
              render: (w) =>
                new Set(
                  state.times
                    .filter((t) => t.obraId === w.id)
                    .map((t) => t.pessoaId),
                ).size,
            },
            {
              label: "Equipamentos atuais",
              render: (w) => open.filter((a) => a.obraId === w.id).length,
            },
            { label: "Estado", render: (w) => <Badge>{w.estado}</Badge> },
          ]}
        />
      ) : john ? (
        <Table
          rows={attention}
          onRow={(work) => router.push(`/obras/${work.id}`)}
          columns={[
            {
              label: "Obra",
              render: (work) => (
                <div className="work-cell">
                  <span className="work-icon"><Building2 size={18} /></span>
                  <div>
                    <b>{work.numero} <span className="separator">/</span> {work.nome}</b>
                    <small>{work.cliente === "Por confirmar" ? "Cliente por confirmar" : work.cliente}</small>
                  </div>
                </div>
              ),
            },
            { label: "Valor da obra", render: (work) => money(workFinancials(state, work.id, ledger).budget), align: "right" },
            { label: "Margem alvo", render: (work) => `${num(workFinancials(state, work.id, ledger).target * 100, 1)}%`, align: "right" },
            { label: "Custo máximo", render: (work) => money(workFinancials(state, work.id, ledger).max), align: "right" },
            { label: "Custo atual", render: (work) => <b>{money(workFinancials(state, work.id, ledger).cost)}</b>, align: "right" },
            {
              label: "Motivo do alerta",
              render: (work) => (
                <div>
                  <Badge>{workFinancials(state, work.id, ledger).risk}</Badge>
                  <small className="block muted">{alertReason(work.id)}</small>
                </div>
              ),
            },
          ]}
        />
      ) : (
        <WorkTable rows={attention} compact />
      )}
      <div className="grid-two bottom-grid">
        <Panel
          title={management ? "Custos por origem" : "Atividade recente"}
          actions={
            <button
              className="text-button"
              onClick={() =>
                router.push(management ? "/controlo" : "/armazem/movimentos")
              }
            >
              Ver detalhe <ArrowUpRight size={15} />
            </button>
          }
        >
          {management ? (
            <CostBreakdown
              costs={ledger}
              onCategory={() => router.push("/controlo")}
            />
          ) : (
            <div className="activity-list">
              {[
                ...state.movements.map((m) => ({
                  id: m.id,
                  title: `${m.tipo} de material`,
                  text: m.descricao,
                  obra: m.obraId,
                  data: m.data,
                  icon: <Package size={17} />,
                })),
                ...state.allocations.map((a) => ({
                  id: a.id,
                  title: "Equipamento alocado",
                  text:
                    state.machines.find((m) => m.id === a.maquinaId)?.nome ??
                    "",
                  obra: a.obraId,
                  data: a.saida,
                  icon: <Wrench size={17} />,
                })),
                ...state.invoices
                  .filter((i) => i.source === "demo")
                  .map((i) => ({
                    id: i.id,
                    title: "Fatura adicionada",
                    text: `${i.fornecedor} · ${i.numero}`,
                    obra: i.obraId,
                    data: i.data,
                    icon: <FileText size={17} />,
                  })),
              ]
                .sort((a, b) => b.data.localeCompare(a.data))
                .slice(0, 4)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      router.push(a.obra ? `/obras/${a.obra}` : "/faturas")
                    }
                  >
                    <span className="activity-icon">{a.icon}</span>
                    <span>
                      <b>{a.title}</b>
                      <small>
                        {a.text} · Obra {a.obra}
                      </small>
                    </span>
                    <time>{date(a.data)}</time>
                  </button>
                ))}
            </div>
          )}
        </Panel>
        <Panel
          title={
            operational ? "Equipamentos disponíveis" : "Armazém e recursos"
          }
          subtitle="Disponibilidade para a próxima operação"
        >
          <div className="resource-overview">
            <button onClick={() => router.push("/armazem/recursos")}>
              <Package size={20} />
              <div>
                <b>{john ? money(stockValue) : state.articles.length}</b>
                <span>{john ? "Valor atual do stock" : "Artigos em catálogo"}</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => router.push("/armazem/recursos?tipo=Máquinas e equipamentos")}>
              <Wrench size={20} />
              <div>
                <b>{john ? open.length : available.length}</b>
                <span>{john ? "Máquinas em obra" : "Equipamentos disponíveis"}</span>
              </div>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => router.push("/armazem/recursos?alerta=baixo")}>
              <TriangleAlert size={20} />
              <div>
                <b>{low.length}</b>
                <span>Artigos abaixo do mínimo</span>
              </div>
              <Badge tone="amber">Repor</Badge>
            </button>
          </div>
          <div className="panel-bottom">
            <span>{john ? "Inventário de agosto · valor interno demo" : "Inventário de agosto · mínimos demo"}</span>
            <button
              className="text-button"
              onClick={() => router.push("/armazem/tablet")}
            >
              Abrir tablet <ArrowUpRight size={15} />
            </button>
          </div>
        </Panel>
      </div>
      <p className="footnote">
        Demo operacional · histórico ACRS até agosto de 2026 e cenários de
        setembro. Orçamentos e políticas de custo demonstrativos.
      </p>
    </>
  );
}
