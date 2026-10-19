"use client";
import { useState, useEffect } from "react";
import { Plus, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useStore } from "./store";
import { applyAllocation, days, validDate } from "@/lib/engine";
import { date, includes, money, sum, today, uid } from "@/lib/format";
import type { Cost, Machine } from "@/types/index";
import {
  persistAllocationToSupabase,
  persistManualCostToSupabase,
  persistMachineToSupabase,
} from "@/lib/supabase/service";
import {
  Badge,
  Button,
  DetailList,
  Field,
  Metric,
  Modal,
  Note,
  PageHeader,
  SearchInput,
  Select,
  Table,
} from "./ui";

export function machineInspectionStatus(m: Machine): {
  label: string;
  tone?: "red" | "amber" | "green";
  overdue: boolean;
} {
  if (!m.proximaInspecao) {
    return { label: "Sem inspeção agendada", overdue: false };
  }
  const t = today();
  if (m.proximaInspecao < t) {
    return { label: "Inspeção ultrapassada", tone: "red", overdue: true };
  }
  const diff = Math.floor(
    (Date.parse(m.proximaInspecao + "T00:00:00Z") -
      Date.parse(t + "T00:00:00Z")) /
      86400000,
  );
  if (diff <= 30) {
    return { label: `Inspeção em ${diff}d`, tone: "amber", overdue: false };
  }
  return { label: `Em dia (${date(m.proximaInspecao)})`, tone: "green", overdue: false };
}
export function Machines({ tablet = false, initialWork = "" }: { tablet?: boolean; initialWork?: string }) {
  const { state, setState, profile, notify } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [inspectionOnly, setInspectionOnly] = useState(false);
  const [selected, setSelected] = useState<Machine | null>(null);
  const [action, setAction] = useState("");
  const [work, setWork] = useState(initialWork);
  const [effective, setEffective] = useState(today());
  const [rate, setRate] = useState(0);
  const [damage, setDamage] = useState("");
  const [amount, setAmount] = useState(0);
  const [periodicity, setPeriodicity] = useState(12);
  const [editAcquisitionDate, setEditAcquisitionDate] = useState("");
  const [editAcquisitionCost, setEditAcquisitionCost] = useState(0);
  const [editInternalRate, setEditInternalRate] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        const found = state.machines.find((m) => m.id === id);
        if (found) setSelected(found);
      }
      if (params.get("alerta") === "inspecao") setInspectionOnly(true);
    }
  }, [state.machines]);
  const open = (id: string) =>
    state.allocations.find((a) => a.maquinaId === id && !a.devolucao);
  const status = (m: Machine) => (open(m.id) ? "Em obra" : m.estado);
  const rows = state.machines.filter(
    (m) =>
      includes(`${m.numero} ${m.nome} ${m.marca}`, q) &&
      (!filter || status(m) === filter) &&
      (!inspectionOnly ||
        machineInspectionStatus(m).overdue ||
        machineInspectionStatus(m).tone === "amber"),
  );
  function begin(a: string) {
    setAction(a);
    setError("");
    setEffective(today());
    setRate(selected?.custoDia ?? 0);
    setWork(open(selected?.id ?? "")?.obraId ?? "");
    if (a === "inspection") {
      setPeriodicity(selected?.periodicidadeInspecao ?? 12);
    }
    if (a === "edit") {
      setEditAcquisitionDate(selected?.dataAquisicao ?? "");
      setEditAcquisitionCost(selected?.custoAquisicao ?? 0);
      setEditInternalRate(selected?.custoInternoDia ?? 0);
    }
  }
  function confirm() {
    if (!selected) return;
    try {
      if (action === "allocate") {
        const alloc = {
          id: uid("al"),
          maquinaId: selected.id,
          obraId: work,
          saida: effective,
          devolucao: null,
          custoDia: rate,
          utilizador: profile,
          registadoEm: new Date().toISOString(),
          source: "demo" as const,
        };
        setState(applyAllocation(state, alloc));
        persistAllocationToSupabase(alloc, profile).catch(console.error);
        notify("Máquina alocada à obra.");
      } else if (action === "return") {
        const a = open(selected.id);
        if (!a || !effective || effective < a.saida || effective > today())
          throw new Error("A devolução deve ficar entre a saída e hoje.");
        const updatedAlloc = { ...a, devolucao: effective };
        setState({
          ...state,
          allocations: state.allocations.map((x) =>
            x.id === a.id ? updatedAlloc : x,
          ),
        });
        persistAllocationToSupabase(updatedAlloc, profile).catch(console.error);
        notify("Equipamento devolvido. Período de custo fechado.");
      } else if (action === "inspection") {
        if (!effective || !validDate(effective))
          throw new Error("Indique uma data de inspeção válida.");
        const months = periodicity > 0 ? periodicity : 12;
        const d = new Date(effective + "T12:00:00Z");
        d.setMonth(d.getMonth() + months);
        const nextDate = d.toISOString().slice(0, 10);
        const updatedMachine: Machine = {
          ...selected,
          ultimaInspecao: effective,
          periodicidadeInspecao: months,
          proximaInspecao: nextDate,
        };
        setState({
          ...state,
          machines: state.machines.map((m) =>
            m.id === selected.id ? updatedMachine : m,
          ),
        });
        persistMachineToSupabase(updatedMachine, profile).catch(console.error);
        setSelected(updatedMachine);
        notify("Inspeção periódica registada com sucesso.");
      } else if (action === "edit") {
        const updatedMachine: Machine = {
          ...selected,
          dataAquisicao: editAcquisitionDate || null,
          custoAquisicao: editAcquisitionCost > 0 ? editAcquisitionCost : undefined,
          custoDia: rate,
          custoInternoDia: editInternalRate > 0 ? editInternalRate : undefined,
        };
        setState({
          ...state,
          machines: state.machines.map((m) =>
            m.id === selected.id ? updatedMachine : m,
          ),
        });
        persistMachineToSupabase(updatedMachine, profile).catch(console.error);
        setSelected(updatedMachine);
        notify("Dados do equipamento atualizados.");
      } else {
        if (
          !work ||
          !validDate(effective) ||
          !damage.trim() ||
          amount <= 0 ||
          !Number.isFinite(amount)
        )
          throw new Error("Indique obra, descrição e valor do dano.");
        const cost: Cost = {
          id: uid("dano"),
          obraId: work,
          data: effective,
          registadoEm: new Date().toISOString(),
          origem: "Dano / perda",
          origemId: selected.id,
          descricao: `${selected.nome} · ${damage}`,
          categoria: "Ferramentaria",
          quantidade: 1,
          valorUnitario: amount,
          valor: amount,
          utilizador: profile,
          source: "demo",
        };
        setState({
          ...state,
          manualCosts: [
            cost,
            ...state.manualCosts,
          ],
        });
        persistManualCostToSupabase(cost, profile).catch(console.error);
        notify("Dano/perda registado como custo da obra.");
      }
      setAction("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ARMAZÉM"
        title="Máquinas e ferramentaria"
        description="Saiba onde está cada equipamento e a que obra está associado."
        actions={<Badge tone="amber">Cadastro demo</Badge>}
      />
      {!tablet && (
        <div className="metrics five">
          <Metric label="Equipamentos" value={state.machines.length} />
          <Metric
            label="Disponíveis"
            value={
              state.machines.filter((m) => status(m) === "Disponível").length
            }
            accent="positive"
          />
          <Metric
            label="Em obra"
            value={state.machines.filter((m) => status(m) === "Em obra").length}
          />
          <Metric
            label="Em reparação"
            value={
              state.machines.filter((m) => status(m) === "Em reparação").length
            }
          />
          <Metric
            label="Inspeção pendente"
            value={
              state.machines.filter((m) => machineInspectionStatus(m).overdue).length
            }
            accent={
              state.machines.some((m) => machineInspectionStatus(m).overdue)
                ? "danger"
                : undefined
            }
            onClick={() => setInspectionOnly(!inspectionOnly)}
            hint={inspectionOnly ? "A filtrar pendentes" : "Clique para filtrar"}
          />
        </div>
      )}
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar equipamento, número ou marca..."
        />
        <Select
          label="Estado do equipamento"
          value={filter}
          onChange={setFilter}
          placeholder="Todos os estados"
          options={["Disponível", "Em obra", "Em reparação", "Indisponível"]}
        />
        <Button secondary onClick={() => setInspectionOnly(!inspectionOnly)}>
          {inspectionOnly ? "Ver todos os equipamentos" : "Só inspeções pendentes"}
        </Button>
      </div>
      <Table
        rows={rows}
        onRow={(m) => {
          setSelected(m);
          setAction("");
        }}
        columns={[
          { label: "Nº", render: (m) => <b>{m.numero}</b> },
          {
            label: "Equipamento",
            render: (m) => (
              <div>
                <b>{m.nome}</b>
                <small className="block muted">
                  {m.marca} · {m.modelo}
                </small>
              </div>
            ),
          },
          { label: "Estado", render: (m) => <Badge>{status(m)}</Badge> },
          {
            label: "Inspeção",
            render: (m) => {
              const insp = machineInspectionStatus(m);
              return insp.tone ? (
                <Badge tone={insp.tone}>{insp.label}</Badge>
              ) : (
                <span className="muted">—</span>
              );
            },
          },
          {
            label: "Localização / Obra",
            render: (m) => {
              const al = open(m.id);
              if (!al) return m.estado === "Em reparação" ? "Reparação" : "Armazém";
              const w = state.works.find((wk) => wk.id === al.obraId || wk.numero === al.obraId);
              return w ? (w.numero && w.numero !== w.id ? `${w.nome} (${w.numero})` : w.nome) : `Obra ${al.obraId}`;
            },
          },
          { label: "€/dia", render: (m) => money(m.custoDia), align: "right" },
          {
            label: "Custo em curso",
            render: (m) =>
              open(m.id)
                ? money(days(open(m.id)!) * open(m.id)!.custoDia)
                : "—",
            align: "right",
          },
        ]}
      />
      <p className="footnote">
        Tarifas e máquinas demonstrativas. Cálculo por dia de calendário,
        incluindo saída e devolução; convenção a validar.
      </p>
      {selected && (
        <Modal
          title={selected.nome}
          drawer
          onClose={() => {
            setSelected(null);
            setAction("");
          }}
        >
          <div className="drawer-body">
            <div className="detail-hero">
              <Badge>{status(selected)}</Badge>
              <h3>{selected.numero}</h3>
              <p className="muted">
                {selected.marca} · {selected.modelo}
              </p>
            </div>
            <DetailList
              items={[
                ["Tipo", selected.tipo],
                [
                  "Obra atual",
                  (() => {
                    const al = open(selected.id);
                    if (!al) return "—";
                    const w = state.works.find((wk) => wk.id === al.obraId || wk.numero === al.obraId);
                    return w ? (w.numero && w.numero !== w.id ? `${w.nome} (${w.numero})` : w.nome) : `Obra ${al.obraId}`;
                  })(),
                ],
                ["Data de saída", date(open(selected.id)?.saida ?? "")],
                [
                  "Dias em obra",
                  open(selected.id) ? days(open(selected.id)!) : "—",
                ],
                [
                  "Custo diário aplicado",
                  money(open(selected.id)?.custoDia ?? selected.custoDia),
                ],
                [
                  "Inspeção periódica",
                  machineInspectionStatus(selected).label,
                ],
                [
                  "Intervalo de inspeção",
                  selected.periodicidadeInspecao
                    ? `${selected.periodicidadeInspecao} meses`
                    : "12 meses (predefinido)",
                ],
                [
                  "Última inspeção",
                  selected.ultimaInspecao ? date(selected.ultimaInspecao) : "Sem registo",
                ],
                [
                  "Próxima inspeção",
                  selected.proximaInspecao ? date(selected.proximaInspecao) : "Não agendada",
                ],
                [
                  "Data de aquisição",
                  selected.dataAquisicao ? date(selected.dataAquisicao) : "—",
                ],
                [
                  "Período de amortização",
                  selected.periodoAmortizacao
                    ? `${selected.periodoAmortizacao} anos`
                    : "—",
                ],
                [
                  "Custo acumulado",
                  money(
                    sum(
                      state.allocations.filter(
                        (a) => a.maquinaId === selected.id,
                      ),
                      (a) => days(a) * a.custoDia,
                    ),
                  ),
                ],
              ]}
            />
            {!action && (
              <>
                <div className="machine-actions">
                  {status(selected) === "Disponível" && (
                    <Button onClick={() => begin("allocate")}>
                      Alocar a obra <Plus size={16} />
                    </Button>
                  )}
                  {open(selected.id) && (
                    <Button onClick={() => begin("return")}>
                      Devolver ao armazém <RotateCcw size={16} />
                    </Button>
                  )}
                  <Button secondary onClick={() => begin("inspection")}>
                    Registar inspeção <CheckCircle2 size={16} />
                  </Button>
                  <Button secondary onClick={() => begin("damage")}>
                    Registar dano/perda <AlertTriangle size={16} />
                  </Button>
                  <Button secondary onClick={() => begin("edit")}>
                    Editar equipamento / compra
                  </Button>
                </div>
                <h3 className="small-title">Histórico de alocações</h3>
                {state.allocations
                  .filter((a) => a.maquinaId === selected.id)
                  .map((a) => {
                    const w = state.works.find((wk) => wk.id === a.obraId || wk.numero === a.obraId);
                    const title = w ? (w.numero && w.numero !== w.id ? `${w.nome} (${w.numero})` : w.nome) : `Obra ${a.obraId}`;
                    return (
                      <div key={a.id} className="history-card">
                        <b>{title}</b>
                        <span>
                          {date(a.saida)} →{" "}
                          {a.devolucao ? date(a.devolucao) : "Em curso"}
                        </span>
                        <span>
                          {days(a)} dias × {money(a.custoDia)} ={" "}
                          {money(days(a) * a.custoDia)}
                        </span>
                      </div>
                    );
                  })}
              </>
            )}
            {action && (
              <div className="machine-form">
                <h3 className="small-title">
                  {action === "allocate"
                    ? "Alocar a obra"
                    : action === "return"
                      ? "Devolver equipamento"
                      : action === "inspection"
                        ? "Registar inspeção periódica"
                        : action === "edit"
                          ? "Editar equipamento e aquisição"
                          : "Dano / perda"}
                </h3>
                {action !== "return" && action !== "inspection" && action !== "edit" && (
                  <Field label="Obra">
                    <Select
                      label="Obra da máquina"
                      value={work}
                      onChange={setWork}
                      placeholder="Selecionar obra"
                      options={state.works.map((w) => ({
                        value: w.id,
                        label: `${w.numero} · ${w.nome}`,
                      }))}
                    />
                  </Field>
                )}
                {action !== "edit" && (
                  <Field
                    label={
                      action === "return"
                        ? "Data de devolução"
                        : action === "inspection"
                          ? "Data da inspeção realizada"
                          : "Data efetiva"
                    }
                  >
                    <input
                      type="date"
                      value={effective}
                      onChange={(e) => setEffective(e.target.value)}
                    />
                  </Field>
                )}
                {action === "edit" && (
                  <>
                    <Field label="Data de aquisição / compra">
                      <input
                        type="date"
                        value={editAcquisitionDate}
                        onChange={(e) => setEditAcquisitionDate(e.target.value)}
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Preço de aquisição (€)">
                        <input
                          type="number"
                          min="0"
                          value={editAcquisitionCost}
                          onChange={(e) =>
                            setEditAcquisitionCost(Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Tarifa diária à obra (€)">
                        <input
                          type="number"
                          min="0"
                          value={rate}
                          onChange={(e) => setRate(Number(e.target.value))}
                        />
                      </Field>
                    </div>
                    <Field label="Taxa fixa de amortização diária (€)">
                      <input
                        type="number"
                        min="0"
                        value={editInternalRate}
                        onChange={(e) =>
                          setEditInternalRate(Number(e.target.value))
                        }
                      />
                    </Field>
                    <Note>
                      A taxa fixa de amortização diária é o custo interno
                      descontado da faturação às obras para apurar o lucro da
                      ferramentaria destinado ao reinvestimento anual.
                    </Note>
                  </>
                )}
                {action === "inspection" && (
                  <>
                    <Field label="Periodicidade da próxima inspeção (meses)">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={periodicity}
                        onChange={(e) => setPeriodicity(Number(e.target.value))}
                      />
                    </Field>
                    <Note tone="green">
                      A próxima inspeção será automaticamente calculada para daqui a {periodicity || 12} meses após a data indicada.
                    </Note>
                  </>
                )}
                {action === "allocate" && (
                  <Field label="Custo diário (€) · demo">
                    <input
                      type="number"
                      min="0"
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                    />
                  </Field>
                )}
                {action === "damage" && (
                  <>
                    <Field label="Descrição do dano ou perda">
                      <input
                        value={damage}
                        onChange={(e) => setDamage(e.target.value)}
                      />
                    </Field>
                    <Field label="Valor imputado à obra (€)">
                      <input
                        type="number"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                    </Field>
                  </>
                )}
                {action === "return" && selected.tipo === "Caixa" && (
                  <Note>
                    Confirme a integridade da caixa. Eventuais danos ou material
                    em falta podem ser registados como custo adicional.
                  </Note>
                )}
                {error && <Note tone="red">{error}</Note>}
                <div className="form-actions">
                  <Button secondary onClick={() => setAction("")}>
                    Cancelar
                  </Button>
                  <Button onClick={confirm}>Confirmar</Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
