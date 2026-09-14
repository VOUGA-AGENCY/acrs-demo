import type { Article } from "@/types";

export const money = (v: number) =>
  new Intl.NumberFormat("pt-PT", {
    useGrouping: "always",
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  })
    .format(v)
    .replace(/\u00a0/g, " ");
export const num = (v: number, decimals = 1) =>
  new Intl.NumberFormat("pt-PT", {
    useGrouping: "always",
    maximumFractionDigits: decimals,
  }).format(v);
export const qty = (v: number, article?: Article | null, withUnit = true) => {
  const precision = article?.precisao ?? 3;
  const value = new Intl.NumberFormat("pt-PT", {
    useGrouping: "always",
    maximumFractionDigits: precision,
  }).format(v);
  return withUnit && article?.unidade ? `${value} ${article.unidade}` : value;
};
export const date = (v: string) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "—";
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const includes = (text: unknown, query: string) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes(
      query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    );
export const sum = <T>(items: T[], fn: (item: T) => number) =>
  items.reduce((s, item) => s + fn(item), 0);
export const uid = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
