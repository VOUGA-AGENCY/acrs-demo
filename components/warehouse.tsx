"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Wrench,
  RotateCcw,
  Minus,
  Plus,
  Check,
  Layers,
  CalendarDays,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "./store";
import { Resources } from "./resources";
import { applyAllocation, applyMovement, returnable, stock } from "@/lib/engine";
import { date, includes, money, num, qty, sum, today, uid } from "@/lib/format";
import type { Allocation, Article, Movement } from "@/types";
import { persistAllocationToSupabase, persistMovementToSupabase } from "@/lib/supabase/service";
import {
  Badge,
  Button,
  DetailList,
  Field,
  Metric,
  Modal,
  Note,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  Table,
} from "./ui";
import { Machines } from "./machines";
const status = (q: number, min: number | undefined) =>
  q <= 0 ? "Sem stock" : min != null && q < min ? "Stock baixo" : "Normal";
export function WorkSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { state } = useStore();
  return (
    <Select
      label="Obra"
      value={value}
      onChange={onChange}
      placeholder="Selecionar obra"
      options={state.works.map((w) => ({
        value: w.id,
        label: `${w.numero} · ${w.nome}`,
      }))}
    />
  );
}
export function ArticleSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  return (
    <div className="article-picker">
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Pesquisar artigo, código ou marca…"
      />
      <select
        aria-label="Artigo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecionar artigo</option>
        {state.articles
          .filter(
            (a) =>
              a.id === value ||
              includes(
                `${a.codigoACRS} ${a.descricao} ${a.marca} ${a.familia}`,
                q,
              ),
          )
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigoACRS} · {a.descricao} · {a.marca ?? a.tamanho ?? "—"}
            </option>
          ))}
      </select>
    </div>
  );
}
export function StockPage({ simple = false }: { simple?: boolean }) {
  const { state } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [location, setLocation] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("estado") === "baixo")
      setFilter("Stock baixo");
  }, []);
  const rows = state.articles.filter(
    (a) =>
      includes(`${a.codigoACRS} ${a.descricao} ${a.familia} ${a.marca}`, q) &&
      (!family || a.familia === family) &&
      (!material || a.material === material) &&
      (!brand || a.marca === brand) &&
      (!location || a.localizacao === location) &&
      (!filter ||
        status(stock(state, a.id), state.settings.minimos[a.id]) === filter),
  );
  const low = state.articles.filter(
    (a) =>
      status(stock(state, a.id), state.settings.minimos[a.id]) ===
      "Stock baixo",
  );
  return (
    <>
      <PageHeader
        eyebrow={simple ? "CONSULTA" : "ARMAZÉM"}
        title="Stock"
        description="Artigos, disponibilidade e reposição."
        actions={
          !simple ? (
            <Button onClick={() => router.push("/armazem/tablet")}>
              Abrir tablet <ArrowUpRight size={16} />
            </Button>
          ) : undefined
        }
      />
      {!simple && (
        <div className="metrics four">
          <Metric
            label="Artigos em catálogo"
            value={state.articles.length}
            hint="485 linhas do inventário real"
          />
          <Metric
            label="Valor do inventário"
            value={money(
              sum(state.articles, (a) => stock(state, a.id) * a.precoUnitario),
            )}
            hint="Custo de aquisição · sessão"
          />
          <Metric
            label="Abaixo do mínimo"
            value={low.length}
            hint="Mínimos demonstrativos"
            accent="danger"
            onClick={() => setFilter("Stock baixo")}
          />
          <Metric
            label="Sem stock"
            value={state.articles.filter((a) => stock(state, a.id) <= 0).length}
            hint="Artigos a repor"
            onClick={() => setFilter("Sem stock")}
          />
        </div>
      )}
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar código, descrição, família ou marca…"
        />
        <Select
          label="Família"
          value={family}
          onChange={setFamily}
          placeholder="Todas as famílias"
          options={[...new Set(state.articles.map((a) => a.familia))].sort()}
        />
        {!simple && (
          <>
            <Select
              label="Material"
              value={material}
              onChange={setMaterial}
              placeholder="Material"
              options={
                [
                  ...new Set(
                    state.articles.map((a) => a.material).filter(Boolean),
                  ),
                ] as string[]
              }
            />
            <Select
              label="Marca"
              value={brand}
              onChange={setBrand}
              placeholder="Marca"
              options={
                [
                  ...new Set(
                    state.articles.map((a) => a.marca).filter(Boolean),
                  ),
                ] as string[]
              }
            />
            <Select
              label="Localização"
              value={location}
              onChange={setLocation}
              placeholder="Localização"
              options={["ARMAZÉM"]}
            />
          </>
        )}
        <Select
          label="Estado do stock"
          value={filter}
          onChange={setFilter}
          placeholder="Todos os estados"
          options={["Normal", "Stock baixo", "Sem stock"]}
        />
      </div>
      {simple ? (
        <div className="article-grid">
          {rows.map((a) => (
            <button
              className="article-card"
              key={a.id}
              onClick={() => setSelected(a)}
            >
              <div className="article-picture">
                <Package size={30} />
                <span>{a.familia}</span>
              </div>
              <div>
                <b>{a.descricao}</b>
                <small>
                  {a.codigoACRS} · {a.marca ?? "Marca não indicada"}
                </small>
                <strong>
                  {qty(stock(state, a.id), a)} <span>disponíveis</span>
                </strong>
                <small>{a.localizacao}</small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Table
          rows={rows}
          onRow={setSelected}
          pageSize={15}
          columns={[
            {
              label: "Código / Descrição",
              render: (a) => (
                <div>
                  <b>{a.codigoACRS}</b>
                  <small className="block muted">{a.descricao}</small>
                </div>
              ),
            },
            { label: "Família", render: (a) => a.familia },
            { label: "Material", render: (a) => a.material ?? "—" },
            { label: "Tamanho", render: (a) => a.tamanho ?? "—" },
            { label: "Marca", render: (a) => a.marca ?? "—" },
            {
              label: "Stock",
              render: (a) => <b>{qty(stock(state, a.id), a)}</b>,
              align: "right",
            },
            {
              label: "Mínimo",
              render: (a) =>
                state.settings.minimos[a.id] != null
                  ? num(state.settings.minimos[a.id])
                  : "—",
              align: "right",
            },
            {
              label: "Preço unit.",
              render: (a) => money(a.precoUnitario),
              align: "right",
            },
            {
              label: "Valor interno",
              render: (a) =>
                money(state.settings.valoresInternos[a.id] ?? a.precoUnitario),
              align: "right",
            },
            { label: "Localização", render: (a) => a.localizacao ?? "—" },
            {
              label: "Estado",
              render: (a) => (
                <Badge>
                  {status(stock(state, a.id), state.settings.minimos[a.id])}
                </Badge>
              ),
            },
          ]}
        />
      )}
      <p className="footnote">
        Base: inventário de agosto, sem ano indicado na fonte. Quantidades
        ajustadas pelos movimentos da demo. Mínimos e preços internos por
        validar.
      </p>
      {selected && (
        <Modal
          title="Artigo de armazém"
          drawer
          onClose={() => setSelected(null)}
        >
          <div className="drawer-body">
            <div className="detail-hero">
              <Badge>{selected.familia}</Badge>
              <h3>{selected.descricao}</h3>
              <p className="muted">
                {selected.codigoACRS} · {selected.marca ?? "Marca não indicada"}
              </p>
              <strong>{qty(stock(state, selected.id), selected)}</strong>
              <small className="muted"> disponíveis</small>
            </div>
            <DetailList
              items={[
                ["Material", selected.material],
                ["Tamanho", selected.tamanho],
                ["Localização", selected.localizacao],
                ["Quantidade na fonte", qty(selected.quantidade, selected)],
                ["Unidade", `${selected.unidade ?? "Por confirmar"} · demo`],
                ["Preço de aquisição", money(selected.precoUnitario)],
                [
                  "Valor interno · demo",
                  money(
                    state.settings.valoresInternos[selected.id] ??
                      selected.precoUnitario,
                  ),
                ],
                [
                  "Stock mínimo · demo",
                  state.settings.minimos[selected.id] ?? "Não definido",
                ],
                [
                  "Em falta para o mínimo",
                  state.settings.minimos[selected.id] != null
                    ? num(
                        Math.max(
                          0,
                          state.settings.minimos[selected.id] -
                            stock(state, selected.id),
                        ),
                      )
                    : "—",
                ],
              ]}
            />
            <Note>
              Fonte: inventário de agosto · página {selected.sourcePage} · linha{" "}
              {selected.sourceRow}. ID {selected.id}.
            </Note>
            <h3 className="small-title">Movimentos da sessão</h3>
            {state.movements
              .filter((m) => m.artigoId === selected.id)
              .map((m) => (
                <div className="compact-row" key={m.id}>
                  <span>
                    {date(m.data)} · {m.tipo} · Obra {m.obraId || "—"}
                  </span>
                  <b>
                    {qty(
                      m.quantidade,
                      state.articles.find((a) => a.id === m.artigoId),
                    )}
                  </b>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
export function Movements() {
  const { state } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<Movement | null>(null);
  const rows = state.movements.filter(
    (m) =>
      includes(`${m.descricao} ${m.obraId} ${m.utilizador}`, q) &&
      (!type || m.tipo === type),
  );
  return (
    <>
      <PageHeader
        eyebrow="ARMAZÉM"
        title="Movimentos"
        description="Entradas, saídas e devoluções ligadas à obra."
        actions={
          <Button onClick={() => router.push("/armazem/tablet")}>
            Registar movimento <Plus size={16} />
          </Button>
        }
      />
      <div className="filter-bar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Pesquisar artigo ou obra…"
        />
        <Select
          label="Tipo de movimento"
          value={type}
          onChange={setType}
          placeholder="Todos os movimentos"
          options={["Saída", "Devolução", "Entrada", "Outro"]}
        />
      </div>
      <Table
        rows={rows}
        onRow={setSelected}
        columns={[
          { label: "Data efetiva", render: (m) => date(m.data) },
          { label: "Movimento", render: (m) => <Badge>{m.tipo}</Badge> },
          { label: "Artigo", render: (m) => <b>{m.descricao}</b> },
          { label: "Obra", render: (m) => m.obraId || "Armazém" },
          {
            label: "Quantidade",
            render: (m) =>
              qty(
                m.quantidade,
                state.articles.find((a) => a.id === m.artigoId),
              ),
            align: "right",
          },
          {
            label: "Valor",
            render: (m) => money(m.quantidade * m.valorUnitario),
            align: "right",
          },
          { label: "Registado por", render: (m) => m.utilizador },
          {
            label: "Estado",
            render: (m) => (
              <Badge>{m.data > today() ? "Programado" : "Registado"}</Badge>
            ),
          },
        ]}
      />
      {selected && (
        <Modal
          title="Detalhe do movimento"
          drawer
          onClose={() => setSelected(null)}
        >
          <div className="drawer-body">
            <DetailList
              items={[
                ["Tipo", selected.tipo],
                ["Artigo", selected.descricao],
                ["Obra", selected.obraId || "Armazém"],
                [
                  "Quantidade",
                  qty(
                    selected.quantidade,
                    state.articles.find((a) => a.id === selected.artigoId),
                  ),
                ],
                ["Valor unitário", money(selected.valorUnitario)],
                ["Data efetiva", date(selected.data)],
                ["Data de registo", date(selected.registadoEm)],
                ["Utilizador", selected.utilizador],
                ["Referência", selected.id],
                ["Saída original", selected.origemId ?? "—"],
              ]}
            />
            <Note>
              {selected.tipo === "Entrada"
                ? "A compra aumenta stock. O custo chega à obra na saída."
                : selected.data > today()
                  ? "Movimento programado. A saída reserva disponibilidade; custo efetivo a partir da data indicada."
                  : selected.tipo === "Devolução"
                    ? "Stock reposto e custo corrigido pelo valor da saída original."
                    : "Stock e custo de obra atualizados na mesma operação."}
            </Note>
          </div>
        </Modal>
      )}
    </>
  );
}
type Mode = "home" | "register" | "Saída" | "Devolução" | "Entrada" | "stock" | "machines";
type MixedLine =
  | { kind: "article"; id: string; quantity: number; rate: number }
  | { kind: "machine"; id: string; quantity: 1; rate: number };
const machineFamily = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes("caixa")) return "Ferramentas retornáveis";
  if (value.includes("soldar")) return "Soldadura";
  if (["berbequim", "rebarbadora", "serra", "plasma"].some(word => value.includes(word))) return "Corte e furação";
  return "Energia e apoio";
};
export function Tablet() {
  const { state, setState, profile, notify } = useStore();
  const canSeeCosts = profile !== "Armazém";
  const [mode, setMode] = useState<Mode>("home");
  const [step, setStep] = useState(0);
  const [work, setWork] = useState("");
  const [family, setFamily] = useState("");
  const [articleId, setArticleId] = useState("");
  const [q, setQ] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [effective, setEffective] = useState(today());
  const [original, setOriginal] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [unit, setUnit] = useState("un.");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resourceKind, setResourceKind] = useState<"article" | "machine" | "">("");
  const [machineId, setMachineId] = useState("");
  const [mixedLines, setMixedLines] = useState<MixedLine[]>([]);
  const [lines, setLines] = useState<
    { articleId: string; quantidade: number; valorUnitario: number }[]
  >([]);
  const article = state.articles.find((a) => a.id === articleId);
  const special = article?.descricao.toLowerCase().includes("bobine");
  const wholeUnits =
    special || ["un.", "bobine", "caixa"].includes(article?.unidade ?? unit);
  const alreadyListed = sum(
    [
      ...lines.filter((l) => l.articleId === articleId).map(l => l.quantidade),
      ...mixedLines.filter((l): l is Extract<MixedLine,{kind:"article"}> => l.kind === "article" && l.id === articleId).map(l => l.quantity),
    ],
    value => value,
  );
  const available = article ? stock(state, article.id) - alreadyListed : 0;
  const isOther = articleId === "other";
  const stages =
    mode === "Entrada"
      ? ["Artigo", "Quantidade", "Data", "Confirmar"]
      : mode === "Devolução"
        ? ["Obra", "Saída original", "Quantidade", "Data", "Confirmar"]
        : ["Obra", "Família", "Artigo", "Quantidade", "Data", "Confirmar"];
  function reset(m: Mode) {
    setMode(m);
    setStep(0);
    setWork("");
    setFamily("");
    setArticleId("");
    setQ("");
    setQuantity(1);
    setEffective(today());
    setOriginal("");
    setDescription("");
    setPrice(0);
    setSupplier("");
    setUnit("un.");
    setError("");
    setSuccess(false);
    setLines([]);
    setResourceKind("");
    setMachineId("");
    setMixedLines([]);
  }
  const openMachineIds = new Set(state.allocations.filter(a => !a.devolucao).map(a => a.maquinaId));
  const selectedMachine = state.machines.find(m => m.id === machineId);
  const mixedValue = sum(mixedLines, line => line.quantity * line.rate);
  function addMixedLine(next: "another" | "finish") {
    const line: MixedLine | null = resourceKind === "article" && article
      ? { kind: "article", id: article.id, quantity, rate: price }
      : resourceKind === "machine" && selectedMachine
        ? { kind: "machine", id: selectedMachine.id, quantity: 1, rate: selectedMachine.custoDia }
        : null;
    if (!line) return;
    const nextLines = [...mixedLines, line];
    setMixedLines(nextLines);
    setArticleId(""); setMachineId(""); setFamily(""); setResourceKind(""); setQuantity(1); setQ("");
    setStep(next === "another" ? 1 : 5);
  }
  function confirmMixed() {
    try {
      let base = state;
      for (const line of mixedLines) {
        if (line.kind === "article") {
          const item = base.articles.find(a => a.id === line.id)!;
          const mov: Movement = {
            id: uid("mov"), tipo: "Saída", artigoId: item.id, obraId: work,
            descricao: `${item.descricao} · ${item.codigoACRS} · ${item.marca ?? item.tamanho ?? ""}`,
            quantidade: line.quantity, valorUnitario: line.rate, data: effective,
            registadoEm: new Date().toISOString(), utilizador: profile, source: "demo",
            totalNaSaida: item.descricao.toLowerCase().includes("bobine"),
          };
          base = applyMovement(base, mov);
          persistMovementToSupabase(mov, profile).catch(console.error);
        } else {
          const alloc: Allocation = {
            id: uid("al"), maquinaId: line.id, obraId: work, saida: effective,
            devolucao: null, custoDia: line.rate, utilizador: profile,
            registadoEm: new Date().toISOString(), source: "demo",
          };
          base = applyAllocation(base, alloc);
          persistAllocationToSupabase(alloc, profile).catch(console.error);
        }
      }
      setState(base); notify("Saída de recursos registada."); setSuccess(true);
    } catch (e) { setError((e as Error).message); }
  }
  function selectArticle(a: Article) {
    setArticleId(a.id);
    setPrice(
      mode === "Entrada"
        ? a.precoUnitario
        : (state.settings.valoresInternos[a.id] ?? a.precoUnitario),
    );
    setQuantity(1);
    setStep(step + 1);
    setQ("");
  }
  function confirm() {
    try {
      let base = state;
      let id = articleId;
      if (mode === "Entrada" && isOther) {
        id = uid("artigo");
        base = {
          ...base,
          articles: [
            ...base.articles,
            {
              id,
              codigoACRS: `NOVO-${base.articles.length + 1}`,
              familia: "OUTRO",
              material: null,
              tamanho: null,
              descricao: description,
              marca: null,
              quantidade: 0,
              precoUnitario: price,
              precoTotal: 0,
              localizacao: "ARMAZÉM",
              unidade: unit,
              precisao: unit === "un." || unit === "bobine" ? 0 : 3,
              unidadeSource: "demo",
              source: "demo",
            },
          ],
        };
      }
      if (isOther && !description.trim())
        throw new Error("Indique a descrição.");
      const m: Movement = {
        id: uid("mov"),
        tipo:
          isOther && mode === "Saída" ? "Outro" : (mode as Movement["tipo"]),
        artigoId: id,
        obraId: mode === "Entrada" ? "" : work,
        descricao: isOther
          ? description
          : `${article?.descricao} · ${article?.codigoACRS} · ${article?.marca ?? article?.tamanho ?? ""}`,
        quantidade: quantity,
        valorUnitario: price,
        data: effective,
        registadoEm: new Date().toISOString(),
        utilizador: profile,
        source: "demo",
        origemId: original || undefined,
        fornecedor: supplier || undefined,
        totalNaSaida: mode === "Saída" && special,
      };
      if (mode === "Saída") {
        const finalLines = lines.length
          ? lines
          : [{ articleId, quantidade: quantity, valorUnitario: price }];
        for (const line of finalLines) {
          const selectedArticle = base.articles.find(
            (a) => a.id === line.articleId,
          );
          const mov: Movement = {
            ...m,
            id: uid("mov"),
            artigoId: line.articleId,
            descricao: `${selectedArticle?.descricao} · ${selectedArticle?.codigoACRS} · ${selectedArticle?.marca ?? selectedArticle?.tamanho ?? ""}`,
            quantidade: line.quantidade,
            valorUnitario: line.valorUnitario,
            totalNaSaida:
              selectedArticle?.descricao.toLowerCase().includes("bobine") ??
              false,
          };
          base = applyMovement(base, mov);
          persistMovementToSupabase(mov, profile).catch(console.error);
        }
      } else {
        base = applyMovement(base, m);
        persistMovementToSupabase(m, profile).catch(console.error);
      }
      setState(base);
      notify(
        `${mode === "Saída" ? "Saída registada" : mode === "Devolução" ? "Devolução registada" : "Entrada registada"}.`,
      );
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const stage = stages[step];
  const filtered = state.articles.filter(
    (a) =>
      (!family || a.familia === family) &&
      includes(`${a.codigoACRS} ${a.descricao} ${a.marca}`, q),
  );
  return (
    <div className="tablet-container">
      {mode !== "home" && (
        <button
          className="back-link"
          onClick={() => {
            if (mode === "register" && !success && step === 5) setStep(1);
            else if (step > 0 && !success && mode !== "stock" && mode !== "machines") setStep(step - 1);
            else reset("home");
          }}
        >
          <ArrowLeft size={18} />
          {step > 0 && !success ? "Passo anterior" : "Início do armazém"}
        </button>
      )}
      {mode === "home" ? (
        <>
          <div className="tablet-greeting">
            <div className="eyebrow">OPERAÇÃO DE ARMAZÉM</div>
            <h1>O que vamos registar?</h1>
            <p>Selecione uma operação para começar.</p>
          </div>
          <div className="tablet-home-grid">
            {(
              [
                {
                  mode: "register",
                  title: "Registar movimento",
                  text: "Selecionar obra e depois o tipo de recurso",
                  icon: ArrowUpFromLine,
                },
                {
                  mode: "stock",
                  title: "Consultar recursos",
                  text: "Encontrar materiais, ferramentas e equipamentos",
                  icon: Search,
                },
              ] as const
            ).map((item, i) => (
              <button
                key={item.mode}
                className={i === 0 ? "primary" : ""}
                onClick={() => reset(item.mode)}
              >
                <item.icon size={30} />
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </div>
                <ArrowRight size={21} />
              </button>
            ))}
          </div>
          <div className="tablet-footer">
            <span>
              <Package size={16} /> {state.articles.length + state.machines.length} recursos no armazém
            </span>
            <span>Registos guardados apenas nesta sessão</span>
          </div>
        </>
      ) : mode === "register" && success ? (
        <div className="success-view"><div className="success-icon"><Check size={36}/></div><h1>Saída registada.</h1><p>O stock e os equipamentos foram atualizados.</p><div className="success-summary"><b>{mixedLines.length} recurso{mixedLines.length === 1 ? "" : "s"} registado{mixedLines.length === 1 ? "" : "s"}</b><span>Obra {work} · {state.works.find(w => w.id === work)?.nome}</span><span>{date(effective)}</span></div><div className="header-actions"><Button onClick={() => reset("register")}>Registar outra saída</Button><Button secondary onClick={() => reset("home")}>Voltar ao início</Button></div></div>
      ) : mode === "register" ? (
        <div className="tablet-flow">
          {step === 0 ? <>
            <div className="tablet-greeting"><div className="eyebrow">PASSO 1</div><h1>Selecionar obra</h1><p>Todos os movimentos ficam ligados a esta obra.</p></div>
            <div className="choice-list">{state.works.filter(w => w.estado === "Em curso").map(w => <button key={w.id} onClick={() => {setWork(w.id);setStep(1);}}><b>{w.numero} · {w.nome}</b><span>{w.cliente}</span><ArrowRight size={18}/></button>)}</div>
          </> : step === 1 ? <>
            <div className="tablet-greeting"><div className="eyebrow">PASSO 2</div><h1>Tipo de recurso</h1><p>Obra {work} · {mixedLines.length ? `${mixedLines.length} recurso${mixedLines.length === 1 ? "" : "s"} já na lista.` : "Escolha o que vai sair."}</p></div>
            <div className="tablet-home-grid">
              <button className="primary" onClick={() => {setResourceKind("article");setStep(2);}}><Package size={30}/><div><h2>Consumível ou material</h2><p>Selecionar recurso e quantidade</p></div><ArrowRight size={21}/></button>
              <button onClick={() => {setResourceKind("machine");setStep(2);}}><Wrench size={30}/><div><h2>Maquinaria ou equipamento</h2><p>Alocação individual</p></div><ArrowRight size={21}/></button>
            </div>
            {mixedLines.length > 0 && <div className="mixed-list-preview"><b>Lista atual</b>{mixedLines.map((line,index) => {const label=line.kind === "article" ? state.articles.find(a=>a.id===line.id)?.descricao : state.machines.find(m=>m.id===line.id)?.nome;const listedArticle=line.kind === "article" ? state.articles.find(a=>a.id===line.id) : undefined;return <div key={`${line.kind}-${line.id}-${index}`}><span>{label}</span><small>{line.kind === "article" ? qty(line.quantity,listedArticle) : "1 equipamento"}</small></div>;})}</div>}
          </> : step === 2 ? <>
            <div className="tablet-greeting"><div className="eyebrow">PASSO 3</div><h1>Selecionar família</h1><p>{resourceKind === "article" ? "Famílias de consumíveis e materiais" : "Famílias de maquinaria e equipamentos"}</p></div>
            <div className="family-grid">{(resourceKind === "article" ? [...new Set(state.articles.map(a=>a.familia))] : [...new Set(state.machines.map(m=>machineFamily(m.nome)))]).sort().map(f => <button key={f} onClick={() => {setFamily(f);setStep(3);}}><Layers size={23}/><b>{f}</b></button>)}</div>
          </> : step === 3 ? <>
            <div className="tablet-greeting"><div className="eyebrow">PASSO 4</div><h1>Selecionar artigo</h1><p>{family}</p></div>
            <SearchInput value={q} onChange={setQ} placeholder="Pesquisar referência, nome ou marca…"/>
            <div className="article-grid">{resourceKind === "article" ? state.articles.filter(a=>a.familia===family && stock(state,a.id)>0 && includes(`${a.codigoACRS} ${a.descricao} ${a.marca}`,q)).map(a=><button className="article-card" key={a.id} onClick={()=>{setArticleId(a.id);setPrice(state.settings.valoresInternos[a.id] ?? a.precoUnitario);setQuantity(1);setStep(4);}}><div className="article-picture"><Package size={28}/></div><div><b>{a.descricao}</b><small>{a.codigoACRS} · {a.marca ?? "—"}</small><strong>{qty(stock(state,a.id),a)}<span> disponíveis</span></strong></div></button>) : state.machines.filter(m=>machineFamily(m.nome)===family && m.estado === "Disponível" && !openMachineIds.has(m.id) && !mixedLines.some(line=>line.kind === "machine" && line.id === m.id) && includes(`${m.numero} ${m.nome} ${m.marca}`,q)).map(m=><button className="article-card" key={m.id} onClick={()=>{setMachineId(m.id);setQuantity(1);setStep(4);}}><div className="article-picture"><Wrench size={28}/></div><div><b>{m.nome}</b><small>{m.numero} · {m.marca}</small></div></button>)}</div>
          </> : step === 4 ? <>
            <div className="tablet-greeting"><div className="eyebrow">PASSO 5</div><h1>Quantidade</h1><p>{resourceKind === "article" ? article?.descricao : selectedMachine?.nome}</p></div>
            {resourceKind === "machine" ? <Note>Este recurso é identificado individualmente. A quantidade da saída é 1.</Note> : special ? <Note tone="amber">Cada bobine retirada é imputada integralmente na primeira saída.</Note> : null}
            <div className="quantity-control"><button aria-label="Diminuir quantidade" disabled={resourceKind === "machine"} onClick={()=>setQuantity(Math.max(wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3),quantity-(wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3))))}><Minus size={26}/></button><input aria-label="Quantidade" type="number" step={wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3)} readOnly={resourceKind === "machine"} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/><button aria-label="Aumentar quantidade" disabled={resourceKind === "machine"} onClick={()=>setQuantity(quantity+(wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3)))}><Plus size={26}/></button></div>
            <p className="quantity-help">{resourceKind === "article" ? `${qty(available,article)} disponíveis` : "1 equipamento selecionado"}</p>
            <div className="form-actions mixed-decision"><Button secondary disabled={resourceKind === "article" && (quantity <= 0 || quantity > available || (special && !Number.isInteger(quantity)))} onClick={()=>addMixedLine("another")}>ADICIONAR OUTRO ARTIGO <Plus size={17}/></Button><Button disabled={resourceKind === "article" && (quantity <= 0 || quantity > available || (special && !Number.isInteger(quantity)))} onClick={()=>addMixedLine("finish")}>TERMINAR LISTA <Check size={17}/></Button></div>
          </> : step === 5 ? <>
            <div className="tablet-greeting"><div className="eyebrow">PASSO 6</div><h1>Data da saída</h1><p>A mesma data será aplicada a todos os recursos da lista.</p></div><div className="date-field"><Field label="Data efetiva"><input type="date" value={effective} onChange={e=>setEffective(e.target.value)}/></Field></div><div className="form-actions"><Button disabled={!effective} onClick={()=>setStep(6)}>Rever lista <ArrowRight size={17}/></Button></div>
          </> : <>
            <div className="tablet-greeting"><div className="eyebrow">CONFIRMAÇÃO</div><h1>Confirmar saída</h1><p>Obra {work} · {date(effective)}</p></div>
            <div className="movement-list">{mixedLines.map((line,index)=>{const a=line.kind === "article" ? state.articles.find(item=>item.id===line.id) : undefined;const m=line.kind === "machine" ? state.machines.find(item=>item.id===line.id) : undefined;return <div key={`${line.kind}-${line.id}-${index}`}><span>{line.kind === "article" ? `${a?.codigoACRS} · ${a?.descricao}` : `${m?.numero} · ${m?.nome}`}</span><b>{line.kind === "article" ? qty(line.quantity,a) : "1 equipamento"}</b><button className="text-button" onClick={()=>{const next=mixedLines.filter((_,i)=>i!==index);setMixedLines(next);if(!next.length)setStep(1);}}>Remover</button></div>;})}</div>
            <DetailList items={[["Obra",`${work} · ${state.works.find(w=>w.id===work)?.nome}`],["Recursos",String(mixedLines.length)],["Data efetiva",date(effective)],["Registado por",profile]]}/><Note>Consumíveis reduzem o stock. Máquinas e equipamentos ficam alocados à obra até à devolução.</Note>{error && <Note tone="red">{error}</Note>}<div className="form-actions"><Button secondary onClick={()=>setStep(5)}>Alterar data</Button><Button onClick={confirmMixed}>Confirmar saída <Check size={17}/></Button></div>
          </>}
        </div>
      ) : mode === "stock" ? (
        <Resources hideCosts={!canSeeCosts} />
      ) : mode === "machines" ? (
        <Machines tablet initialWork={work} />
      ) : success ? (
        <div className="success-view">
          <div className="success-icon">
            <Check size={36} />
          </div>
          <h1>
            {mode === "Saída"
              ? "Saída registada."
              : mode === "Devolução"
                ? "Devolução registada."
                : "Entrada registada."}
          </h1>
          <p>
            {mode === "Entrada"
              ? "O stock foi atualizado."
              : "O stock e a obra foram atualizados."}
          </p>
          <div className="success-summary">
            <b>
              {mode === "Saída" && lines.length
                ? `${lines.length} artigos registados`
                : (article?.descricao ?? description)}
            </b>
            <span>
              {mode === "Saída" && lines.length
                ? money(sum(lines, (l) => l.quantidade * l.valorUnitario))
                : `${qty(quantity, article)} × ${money(price)} = ${money(quantity * price)}`}
            </span>
            {work && (
              <span>
                Obra {work} · {state.works.find((w) => w.id === work)?.nome}
              </span>
            )}
          </div>
          <div className="header-actions">
            <Button onClick={() => reset(mode)}>
              Registar outro movimento
            </Button>
            <Button secondary onClick={() => reset("home")}>
              Voltar ao início
            </Button>
          </div>
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow="ARMAZÉM"
            title={mode === "Saída" ? "Saída de material" : mode}
            description={`Passo ${step + 1} de ${stages.length} · ${stage}`}
          />
          <div className="stepper">
            {stages.map((s, i) => (
              <div
                className={i === step ? "active" : i < step ? "done" : ""}
                key={s}
              >
                <span>{i < step ? <Check size={14} /> : i + 1}</span>
                <b>{s}</b>
              </div>
            ))}
          </div>
          <div className="wizard-panel">
            {stage === "Obra" && (
              <>
                <h2>Para que obra?</h2>
                <SearchInput
                  value={q}
                  onChange={setQ}
                  placeholder="Pesquisar número ou nome da obra…"
                />
                <div className="work-selection">
                  {state.works
                    .filter((w) => includes(`${w.numero} ${w.nome}`, q))
                    .map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          setWork(w.id);
                          setStep(step + 1);
                          setQ("");
                        }}
                      >
                        <span>{w.numero}</span>
                        <b>{w.nome}</b>
                        <Badge>{w.estado}</Badge>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                </div>
              </>
            )}
            {stage === "Família" && (
              <>
                <h2>Que tipo de material?</h2>
                <div className="family-grid">
                  {[...new Set(state.articles.map((a) => a.familia))]
                    .sort()
                    .map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setFamily(f);
                          setStep(step + 1);
                        }}
                      >
                        <Layers size={23} />
                        <b>{f}</b>
                        <small>
                          {state.articles.filter((a) => a.familia === f).length}{" "}
                          artigos
                        </small>
                      </button>
                    ))}
                </div>
              </>
            )}
            {stage === "Artigo" && (
              <>
                <h2>
                  {mode === "Entrada"
                    ? "Que artigo está a entrar?"
                    : `Selecionar artigo · ${family}`}
                </h2>
                <SearchInput
                  value={q}
                  onChange={setQ}
                  placeholder="Pesquisar código, artigo ou marca…"
                />
                {mode === "Entrada" && (
                  <Button
                    secondary
                    onClick={() => {
                      setArticleId("other");
                      setStep(step + 1);
                    }}
                  >
                    Outro / Novo artigo <Plus size={16} />
                  </Button>
                )}
                <div className="article-grid">
                  {filtered.map((a) => (
                    <button
                      className="article-card"
                      key={a.id}
                      disabled={mode === "Saída" && stock(state, a.id) <= 0}
                      onClick={() => selectArticle(a)}
                    >
                      <div className="article-picture">
                        <Package size={28} />
                      </div>
                      <div>
                        <b>{a.descricao}</b>
                        <small>
                          {a.codigoACRS} · {a.marca ?? a.tamanho ?? "—"}
                        </small>
                        <strong>
                          {qty(stock(state, a.id), a)}
                          <span> disponíveis</span>
                        </strong>
                      </div>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {stage === "Saída original" && (
              <>
                <h2>Que material regressou?</h2>
                <p className="muted">
                  Selecione a saída para preservar o valor originalmente
                  imputado.
                </p>
                <div className="work-selection">
                  {state.movements
                    .filter(
                      (m) => m.obraId === work && returnable(state, m.id) > 0,
                    )
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setOriginal(m.id);
                          setArticleId(m.artigoId);
                          setPrice(m.valorUnitario);
                          setQuantity(1);
                          setStep(step + 1);
                        }}
                      >
                        <div>
                          <b>{m.descricao}</b>
                          <small className="block muted">
                            {date(m.data)} ·{" "}
                            {qty(
                              returnable(state, m.id),
                              state.articles.find((a) => a.id === m.artigoId),
                            )}{" "}
                            por
                            devolver
                          </small>
                        </div>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                </div>
                {!state.movements.some(
                  (m) => m.obraId === work && returnable(state, m.id) > 0,
                ) && (
                  <Note>
                    Esta obra não tem saídas com saldo devolvível. Bobines
                    consumidas integralmente não podem voltar ao stock.
                  </Note>
                )}
              </>
            )}
            {stage === "Quantidade" && (
              <>
                <h2>
                  {isOther ? "Artigo não catalogado" : article?.descricao}
                </h2>
                {isOther && (
                  <>
                    <Field label="Descrição">
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descreva o material"
                      />
                    </Field>
                    <Field label="Unidade">
                      <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                        <option>un.</option>
                        <option>kg</option>
                        <option>m</option>
                        <option>l</option>
                        <option>caixa</option>
                        <option>bobine</option>
                      </select>
                    </Field>
                  </>
                )}
                <p className="muted">
                  {article?.codigoACRS} {article?.marca && `· ${article.marca}`}
                </p>
                {special && mode === "Saída" ? (
                  <Note tone="amber">
                    Cada bobine retirada é imputada integralmente. Existem{" "}
                    {qty(available, article)} disponíveis; as bobines retiradas
                    não poderão ser devolvidas.
                  </Note>
                ) : null}
                <div className="quantity-control">
                  <button
                    aria-label="Diminuir quantidade"
                    onClick={() =>
                      setQuantity(
                        Math.max(
                          wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3),
                          quantity -
                            (wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3)),
                        ),
                      )
                    }
                  >
                    <Minus size={26} />
                  </button>
                  <input
                    aria-label="Quantidade"
                    type="number"
                    min="0.01"
                    step={wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3)}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                  <button
                    aria-label="Aumentar quantidade"
                    onClick={() =>
                      setQuantity(
                        quantity +
                          (wholeUnits ? 1 : 10 ** -(article?.precisao ?? 3)),
                      )
                    }
                  >
                    <Plus size={26} />
                  </button>
                </div>
                <p className="quantity-help">
                  {mode === "Devolução"
                    ? `${qty(returnable(state, original), article)} por devolver`
                    : mode === "Saída" && !isOther
                      ? `${qty(available, article)} disponíveis`
                      : "Quantidade recebida"}
                </p>
                {(isOther || mode === "Entrada") && (
                  <Field label="Preço unitário (€)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                    />
                  </Field>
                )}
                {mode === "Entrada" && (
                  <Field label="Fornecedor (opcional)">
                    <input
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Nome do fornecedor"
                    />
                  </Field>
                )}
                <div className="form-actions">
                  {mode === "Saída" && (
                    <Button
                      secondary
                      disabled={
                        quantity <= 0 ||
                        !Number.isFinite(quantity) ||
                        quantity > available ||
                        (special && !Number.isInteger(quantity))
                      }
                      onClick={() => {
                        setLines([
                          ...lines,
                          {
                            articleId,
                            quantidade: quantity,
                            valorUnitario: price,
                          },
                        ]);
                        setArticleId("");
                        setQuantity(1);
                        setQ("");
                        setStep(2);
                      }}
                    >
                      Adicionar outro artigo <Plus size={17} />
                    </Button>
                  )}
                  <Button
                    disabled={
                      quantity <= 0 ||
                      !Number.isFinite(quantity) ||
                      (mode === "Saída" && !isOther && quantity > available) ||
                      (mode === "Devolução" &&
                        quantity > returnable(state, original)) ||
                      (isOther && !description.trim()) ||
                      price < 0
                    }
                    onClick={() => {
                      if (mode === "Saída")
                        setLines([
                          ...lines,
                          {
                            articleId,
                            quantidade: quantity,
                            valorUnitario: price,
                          },
                        ]);
                      setStep(step + 1);
                    }}
                  >
                    Continuar <ArrowRight size={17} />
                  </Button>
                </div>
              </>
            )}
            {stage === "Data" && (
              <>
                <h2>Quando aconteceu?</h2>
                <p className="muted">
                  Pode registar agora um movimento de outra data.
                </p>
                <div className="date-field">
                  <Field label="Data efetiva">
                    <input
                      type="date"
                      value={effective}
                      onChange={(e) => setEffective(e.target.value)}
                    />
                  </Field>
                </div>
                {effective > today() && (
                  <Note tone="amber">
                    Movimento programado. Uma saída reserva stock; o custo entra
                    na obra na data efetiva.
                  </Note>
                )}
                <div className="form-actions">
                  <Button
                    disabled={!effective}
                    onClick={() => setStep(step + 1)}
                  >
                    Rever movimento <ArrowRight size={17} />
                  </Button>
                </div>
              </>
            )}
            {stage === "Confirmar" && (
              <>
                <h2>Confirmar {mode.toLowerCase()}</h2>
                <DetailList
                  items={[
                    [
                      "Obra",
                      mode === "Entrada"
                        ? "Armazém"
                        : `${work} · ${state.works.find((w) => w.id === work)?.nome}`,
                    ],
                    [
                      "Artigo",
                      mode === "Saída"
                        ? `${lines.length} artigo${lines.length === 1 ? "" : "s"}`
                        : (article?.descricao ?? description),
                    ],
                    ...(mode === "Saída"
                      ? [
                          [
                            "Valor total",
                            money(
                              sum(
                                lines,
                                (l) => l.quantidade * l.valorUnitario,
                              ),
                            ),
                          ] as [string, string],
                        ]
                      : [
                          [
                            "Código",
                            article?.codigoACRS ?? "Não catalogado",
                          ] as [string, string],
                          ["Quantidade", qty(quantity, article)] as [
                            string,
                            string,
                          ],
                          ["Valor unitário", money(price)] as [string, string],
                          ["Valor do movimento", money(quantity * price)] as [
                            string,
                            string,
                          ],
                        ]),
                    ["Data efetiva", date(effective)],
                    ["Registado por", profile],
                    ...(supplier
                      ? [["Fornecedor", supplier] as [string, string]]
                      : []),
                  ]}
                />
                {mode === "Saída" && (
                  <div className="movement-list">
                    {lines.map((line, index) => {
                      const a = state.articles.find(
                        (item) => item.id === line.articleId,
                      );
                      return (
                        <div key={`${line.articleId}-${index}`}>
                          <span>{a?.codigoACRS} · {a?.descricao}</span>
                          <b>{qty(line.quantidade, a)} · {money(line.quantidade * line.valorUnitario)}</b>
                          <button
                            className="text-button"
                            onClick={() => {
                              const next = lines.filter((_, i) => i !== index);
                              setLines(next);
                              if (!next.length) setStep(2);
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Note>
                  {mode === "Entrada"
                    ? "Aumenta o stock. Não cria custo direto numa obra."
                    : mode === "Devolução"
                      ? "Aumenta o stock e corrige o custo da obra pelo valor original."
                      : "Reduz a disponibilidade em stock e associa o custo à obra."}
                </Note>
                {error && <Note tone="red">{error}</Note>}
                <div className="form-actions">
                  <Button secondary onClick={() => setStep(step - 1)}>
                    Voltar
                  </Button>
                  <Button onClick={confirm}>
                    Confirmar {mode.toLowerCase()} <Check size={17} />
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
