"use client";
import { useState } from "react";
import { Plus, Wrench, RotateCcw, AlertTriangle } from "lucide-react";
import { useStore } from "./store";
import { applyAllocation, days, validDate } from "@/lib/engine";
import { date, includes, money, num, sum, today, uid } from "@/lib/format";
import type { Machine } from "@/types";
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
export function Machines({ tablet = false, initialWork = "" }: { tablet?: boolean; initialWork?: string }) {
  const { state, setState, profile, notify } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Machine | null>(null);
  const [action, setAction] = useState("");
  const [work, setWork] = useState(initialWork);
  const [effective, setEffective] = useState(today());
  const [rate, setRate] = useState(0);
  const [damage, setDamage] = useState("");
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState("");
  const open = (id: string) =>
    state.allocations.find((a) => a.maquinaId === id && !a.devolucao);
  const status = (m: Machine) => (open(m.id) ? "Em obra" : m.estado);
  const rows = state.machines.filter(
    (m) =>
      includes(`${m.numero} ${m.nome} ${m.marca}`, q) &&
      (!filter || status(m) === filter),
  );
  function begin(a: string) {
    setAction(a);
    setError("");
    setEffective(today());
    setRate(selected?.custoDia ?? 0);
    setWork(open(selected?.id ?? "")?.obraId ?? "");
  }
  function confirm() {
    if (!selected) return;
    try {
      if (action === "allocate") {
        setState(
          applyAllocation(state, {
            id: uid("al"),
            maquinaId: selected.id,
            obraId: work,
            saida: effective,
            devolucao: null,
            custoDia: rate,
            utilizador: profile,
            registadoEm: new Date().toISOString(),
            source: "demo",
          }),
        );
        notify("Máquina alocada à obra.");
      } else if (action === "return") {
        const a = open(selected.id);
        if (!a || !effective || effective < a.saida || effective > today())
          throw new Error("A devolução deve ficar entre a saída e hoje.");
        setState({
          ...state,
          allocations: state.allocations.map((x) =>
            x.id === a.id ? { ...x, devolucao: effective } : x,
          ),
        });
        notify("Equipamento devolvido. Período de custo fechado.");
      } else {
        if (
          !work ||
          !validDate(effective) ||
          !damage.trim() ||
          amount <= 0 ||
          !Number.isFinite(amount)
        )
          throw new Error("Indique obra, descrição e valor do dano.");
        setState({
          ...state,
          manualCosts: [
            {
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
            },
            ...state.manualCosts,
          ],
        });
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
        <div className="metrics four">
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
        </div>
      )}
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar equipamento, número ou marca…"
        />
        <Select
          label="Estado do equipamento"
          value={filter}
          onChange={setFilter}
          placeholder="Todos os estados"
          options={["Disponível", "Em obra", "Em reparação", "Indisponível"]}
        />
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
            label: "Localização / Obra",
            render: (m) =>
              open(m.id)
                ? `${open(m.id)?.obraId} · ${state.works.find((w) => w.id === open(m.id)?.obraId)?.nome}`
                : m.estado === "Em reparação"
                  ? "Reparação"
                  : "Armazém",
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
                ["Obra atual", open(selected.id)?.obraId ?? "—"],
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
                  <Button secondary onClick={() => begin("damage")}>
                    Registar dano/perda <AlertTriangle size={16} />
                  </Button>
                </div>
                <h3 className="small-title">Histórico de alocações</h3>
                {state.allocations
                  .filter((a) => a.maquinaId === selected.id)
                  .map((a) => (
                    <div key={a.id} className="history-card">
                      <b>Obra {a.obraId}</b>
                      <span>
                        {date(a.saida)} →{" "}
                        {a.devolucao ? date(a.devolucao) : "Em curso"}
                      </span>
                      <span>
                        {days(a)} dias × {money(a.custoDia)} ={" "}
                        {money(days(a) * a.custoDia)}
                      </span>
                    </div>
                  ))}
              </>
            )}
            {action && (
              <div className="machine-form">
                <h3 className="small-title">
                  {action === "allocate"
                    ? "Alocar a obra"
                    : action === "return"
                      ? "Devolver equipamento"
                      : "Dano / perda"}
                </h3>
                {action !== "return" && (
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
                <Field
                  label={
                    action === "return" ? "Data de devolução" : "Data efetiva"
                  }
                >
                  <input
                    type="date"
                    value={effective}
                    onChange={(e) => setEffective(e.target.value)}
                  />
                </Field>
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
