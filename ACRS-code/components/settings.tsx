"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { useStore } from "./store";
import { money, includes, num } from "@/lib/format";
import type { Article, Policy } from "@/types";
import {
  Badge,
  Button,
  DetailList,
  Field,
  Modal,
  Note,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
} from "./ui";
export function Settings() {
  const { state, setState, notify } = useStore();
  const [tab, setTab] = useState("Artigos");
  const [q, setQ] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [minimum, setMinimum] = useState("");
  const [price, setPrice] = useState(0);
  const [unit, setUnit] = useState("un.");
  const [precision, setPrecision] = useState(0);
  const [policy, setPolicy] = useState<Policy>(state.settings.policy);
  const [policyPerson, setPolicyPerson] = useState("");
  const [holidays, setHolidays] = useState(state.settings.holidays.join(", "));
  const [error, setError] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Configuração"
        description="Parâmetros da operação, ajustáveis nesta sessão."
        actions={<Badge tone="amber">Regras demo · por validar</Badge>}
      />
      <Tabs
        items={[
          "Artigos",
          "Famílias",
          "Máquinas",
          "Empresas",
          "Categorias",
          "Regras",
          "Utilizadores",
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setQ("");
        }}
      />
      {tab === "Artigos" && (
        <>
          <div className="filter-bar">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Pesquisar artigo para configurar…"
            />
          </div>
          <Table
            rows={state.articles.filter((a) =>
              includes(`${a.codigoACRS} ${a.descricao} ${a.marca}`, q),
            )}
            onRow={(a) => {
              setArticle(a);
              setMinimum(state.settings.minimos[a.id]?.toString() ?? "");
              setPrice(state.settings.valoresInternos[a.id] ?? a.precoUnitario);
              setUnit(a.unidade ?? "un.");
              setPrecision(a.precisao ?? 3);
            }}
            columns={[
              { label: "Código", render: (a) => <b>{a.codigoACRS}</b> },
              { label: "Artigo", render: (a) => a.descricao },
              {
                label: "Marca / Variante",
                render: (a) => `${a.marca ?? "—"} · ${a.tamanho ?? "—"}`,
              },
              { label: "Unidade · demo", render: (a) => a.unidade ?? "—" },
              {
                label: "Mínimo · demo",
                render: (a) => state.settings.minimos[a.id] ?? "Não definido",
              },
              {
                label: "Preço aquisição",
                render: (a) => money(a.precoUnitario),
              },
              {
                label: "Valor interno · demo",
                render: (a) =>
                  money(
                    state.settings.valoresInternos[a.id] ?? a.precoUnitario,
                  ),
              },
            ]}
          />
        </>
      )}
      {tab === "Famílias" && (
        <Table
          rows={[...new Set(state.articles.map((a) => a.familia))].sort()}
          columns={[
            { label: "Família original", render: (f) => <b>{f}</b> },
            {
              label: "Artigos",
              render: (f) =>
                state.articles.filter((a) => a.familia === f).length,
            },
            {
              label: "Regra de saída",
              render: (f) =>
                f === "SOLDA"
                  ? "Unidade / bobine TOTAL_NA_SAIDA"
                  : "Unidade de inventário",
            },
            { label: "Origem", render: () => "Inventário ACRS" },
          ]}
        />
      )}
      {tab === "Máquinas" && (
        <>
          <Table
            rows={state.machines}
            columns={[
              { label: "Número", render: (m) => <b>{m.numero}</b> },
              { label: "Equipamento", render: (m) => m.nome },
              {
                label: "Custo diário (€)",
                render: (m) => (
                  <input
                    aria-label={`Custo diário ${m.numero}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={m.custoDia}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 0 && Number.isFinite(n))
                        setState({
                          ...state,
                          machines: state.machines.map((x) =>
                            x.id === m.id ? { ...x, custoDia: n } : x,
                          ),
                        });
                    }}
                  />
                ),
              },
              {
                label: "Estado do parâmetro",
                render: () => <Badge tone="amber">Demo</Badge>,
              },
            ]}
          />
          <Note>
            Alterar a tarifa afeta apenas futuras alocações. As alocações
            existentes preservam a tarifa registada.
          </Note>
        </>
      )}
      {tab === "Empresas" && (
        <>
          <Table
            rows={state.companies}
            columns={[
              { label: "Empresa", render: (r) => <b>{r.nome}</b> },
              { label: "Tipo", render: (r) => r.tipo },
              {
                label: "Trabalhadores",
                render: (r) =>
                  state.people.filter((p) => p.empresaId === r.id).length,
                align: "right",
              },
              {
                label: "Hora extra",
                render: (r) => {
                  const companyPolicy = {
                    ...state.settings.policy,
                    ...state.settings.companyPolicies[r.id],
                  };
                  return `A partir da ${companyPolicy.limiteExtra + 1}.ª hora · +${num(companyPolicy.extra * 100, 0)}%`;
                },
              },
            ]}
          />
          <Note>
            ACRS, Empresa A, Empresa B, Empresa C e Empresa D são a estrutura
            demonstrativa. A distribuição nominal deverá ser confirmada antes
            da migração.
          </Note>
        </>
      )}
      {tab === "Categorias" && (
        <Table
          rows={[
            "Mão de obra",
            "Materiais",
            "Ferramentaria",
            "Alojamento",
            "Alimentação",
            "Combustível",
            "Outros",
          ]}
          columns={[
            { label: "Categoria de controlo", render: (c) => <b>{c}</b> },
            {
              label: "Imputação",
              render: (c) =>
                c === "Materiais"
                  ? "Entrada em stock → saída para obra"
                  : "Direta à obra",
            },
            { label: "Estado", render: () => <Badge>Ativa</Badge> },
          ]}
        />
      )}
      {tab === "Regras" && (
        <div className="settings-rules">
          <Note tone="amber">
            Regras fornecidas pela ACRS: extra +50%, noturno +25%, sábado,
            domingo e feriado +50%. ACRS a partir da 9.ª hora;
            subcontratados a partir da 11.ª. O tempo de viagem entra no custo
            da obra. A acumulação de suplementos mantém-se desativada.
          </Note>
          <Field label="Âmbito da política">
            <select
              value={policyPerson}
              onChange={(e) => {
                const id = e.target.value;
                setPolicyPerson(id);
                setPolicy({
                  ...state.settings.policy,
                  ...(id ? state.settings.personPolicies[id] : {}),
                  source: "demo",
                });
              }}
            >
              <option value="">Regra global ACRS</option>
              {state.people.map((p) => (
                <option key={p.id} value={p.id}>
                  Exceção · {p.nome}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            {(
              [
                {
                  key: "limiteExtra",
                  label: "Hora extra após (horas)",
                  percent: false,
                },
                {
                  key: "extra",
                  label: "Acréscimo hora extra (%)",
                  percent: true,
                },
                {
                  key: "noturno",
                  label: "Acréscimo noturno (%)",
                  percent: true,
                },
                { key: "sabado", label: "Acréscimo sábado (%)", percent: true },
                {
                  key: "domingo",
                  label: "Acréscimo domingo (%)",
                  percent: true,
                },
                {
                  key: "feriado",
                  label: "Acréscimo feriado (%)",
                  percent: true,
                },
              ] as const
            ).map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type="number"
                  min="0"
                  max={f.percent ? 200 : 24}
                  value={policy[f.key] * (f.percent ? 100 : 1)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      [f.key]: Number(e.target.value) / (f.percent ? 100 : 1),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={policy.acumular}
              onChange={(e) =>
                setPolicy({ ...policy, acumular: e.target.checked })
              }
            />{" "}
            Acumular suplementos (demo)
          </label>
          {error && <Note tone="red">{error}</Note>}
          <Button
            onClick={() => {
              if (
                policy.limiteExtra < 0 ||
                policy.limiteExtra > 24 ||
                [
                  policy.extra,
                  policy.noturno,
                  policy.sabado,
                  policy.domingo,
                  policy.feriado,
                ].some((v) => !Number.isFinite(v) || v < 0 || v > 2)
              ) {
                setError(
                  "Reveja os limites: 0–24 horas e suplementos entre 0–200%.",
                );
                return;
              }
              setState({
                ...state,
                settings: policyPerson
                  ? {
                      ...state.settings,
                      personPolicies: {
                        ...state.settings.personPolicies,
                        [policyPerson]: policy,
                      },
                    }
                  : { ...state.settings, policy },
              });
              setError("");
              notify(
                policyPerson
                  ? "Exceção demo aplicada à pessoa selecionada."
                  : "Política global demo aplicada às estimativas.",
              );
            }}
          >
            Aplicar política demo <Check size={16} />
          </Button>
          <Field label="Feriados (AAAA-MM-DD, separados por vírgula)">
            <input
              value={holidays}
              onChange={(e) => setHolidays(e.target.value)}
              placeholder="2026-12-01, 2026-12-08"
            />
          </Field>
          <Button
            secondary
            onClick={() => {
              const values = holidays
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              if (values.some((v) => !/^\d{4}-\d{2}-\d{2}$/.test(v))) {
                setError("Utilize datas no formato AAAA-MM-DD.");
                return;
              }
              setState({
                ...state,
                settings: { ...state.settings, holidays: values },
              });
              setError("");
              notify("Calendário demo de feriados atualizado.");
            }}
          >
            Guardar calendário
          </Button>
          <DetailList
            items={[
              ["Bobines", "TOTAL_NA_SAIDA · sem reentrada de sobras"],
              ["Máquinas", "Custo ao dia · tarifa congelada na alocação"],
              ["Viaturas", "Sem imputação diária — regra por decidir"],
              ["Contentores em obra", "Localizações e fluxo por validar"],
              ["Inventário inicial", "Reconciliação física pendente"],
            ]}
          />
        </div>
      )}
      {tab === "Utilizadores" && (
        <Table
          rows={[
            [
              "João Catalão",
              "Administrativo",
              "Obras, custos, faturas, ponto e orçamento",
            ],
            ["Vítor", "Operações", "Recursos, obras, máquinas e stock"],
            ["Armazém", "Tablet", "Entradas, saídas e devoluções"],
            ["Gerência", "Consulta", "Visão de gestão e controlo"],
            ["Campo", "Telemóvel", "Envio de despesas"],
          ]}
          columns={[
            { label: "Perfil", render: (r) => <b>{r[0]}</b> },
            { label: "Experiência", render: (r) => r[1] },
            { label: "Âmbito", render: (r) => r[2] },
            {
              label: "Acesso",
              render: () => <Badge tone="neutral">Seletor demo</Badge>,
            },
          ]}
        />
      )}
      {article && (
        <Modal title="Parâmetros do artigo" onClose={() => setArticle(null)}>
          <div className="modal-body">
            <h3>{article.codigoACRS}</h3>
            <p className="muted">
              {article.descricao} · {article.marca ?? "—"}
            </p>
            <div className="form-grid">
              <Field label="Stock mínimo · demo">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                  placeholder="Não definido"
                />
              </Field>
              <Field label="Valor interno (€) · demo">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </Field>
              <Field label="Unidade · por confirmar">
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option>un.</option>
                  <option>kg</option>
                  <option>m</option>
                  <option>l</option>
                  <option>caixa</option>
                  <option>bobine</option>
                </select>
              </Field>
              <Field label="Casas decimais">
                <select
                  value={precision}
                  onChange={(e) => setPrecision(Number(e.target.value))}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </Field>
            </div>
            <Note>
              O custo de aquisição original é preservado. O novo valor interno
              afeta apenas movimentos futuros.
            </Note>
            <div className="form-actions">
              <Button
                onClick={() => {
                  if (
                    price < 0 ||
                    !Number.isFinite(price) ||
                    (minimum !== "" &&
                      (Number(minimum) < 0 ||
                        !Number.isFinite(Number(minimum))))
                  )
                    return;
                  const mins = { ...state.settings.minimos };
                  if (minimum === "") delete mins[article.id];
                  else mins[article.id] = Number(minimum);
                  setState({
                    ...state,
                    articles: state.articles.map((a) =>
                      a.id === article.id
                        ? {
                            ...a,
                            unidade: unit,
                            precisao: precision,
                            unidadeSource: "demo",
                          }
                        : a,
                    ),
                    settings: {
                      ...state.settings,
                      minimos: mins,
                      valoresInternos: {
                        ...state.settings.valoresInternos,
                        [article.id]: price,
                      },
                    },
                  });
                  setArticle(null);
                  notify("Parâmetros atualizados.");
                }}
              >
                Guardar parâmetros <Check size={16} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
