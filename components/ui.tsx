"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Inbox,
} from "lucide-react";
import { num } from "@/lib/format";
export function Button({
  children,
  secondary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`${secondary ? "button secondary" : "button"} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const text = String(children);
  const cls =
    tone ??
    (/ultrapassado|Sem stock|reparação/.test(text)
      ? "red"
      : /Em risco/.test(text)
        ? "orange"
      : /Atenção|Por validar|baixo|confirmar|Demo/.test(text)
        ? "amber"
        : /Saudável|Disponível|Validada|Concluída|Normal/.test(text)
          ? "green"
          : "neutral");
  return <span className={`badge ${cls}`}>{children}</span>;
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}
export function Metric({
  label,
  value,
  hint,
  icon,
  accent,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`metric ${accent ?? ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick?.();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Pesquisar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button aria-label="Limpar pesquisa" onClick={() => onChange("")}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button
          role="tab"
          aria-selected={t === value}
          key={t}
          className={t === value ? "active" : ""}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress-wrap">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <b>{num(value * 100, 0)}%</b>
        </div>
      )}
      <div className="progress">
        <span
          className={value >= 1 ? "red" : value >= 0.8 ? "orange" : value >= 0.7 ? "amber" : "green"}
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  );
}
export type Column<T> = {
  label: string;
  render: (row: T) => ReactNode;
  align?: "right";
  width?: string;
};
export function Table<T>({
  rows,
  columns,
  onRow,
  pageSize = 12,
  empty = "Nenhum registo encontrado.",
  rowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  onRow?: (r: T) => void;
  pageSize?: number;
  empty?: string;
  rowKey?: (r: T) => string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / pageSize);
  const p = Math.min(page, Math.max(0, pages - 1));
  useEffect(() => setPage(0), [rows.length]);
  return (
    <div className="table-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} style={{ textAlign: c.align, width: c.width }}>
                  {c.label}
                </th>
              ))}
              {onRow && <th className="arrow-col" />}
            </tr>
          </thead>
          <tbody>
            {rows.slice(p * pageSize, (p + 1) * pageSize).map((r, i) => (
              <tr
                key={rowKey?.(r) ?? i}
                className={onRow ? "interactive" : ""}
                tabIndex={onRow ? 0 : undefined}
                onClick={() => onRow?.(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRow?.(r);
                }}
              >
                {columns.map((c, j) => (
                  <td key={j} style={{ textAlign: c.align }}>
                    {c.render(r)}
                  </td>
                ))}
                {onRow && (
                  <td>
                    <ArrowUpRight size={15} className="row-arrow" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>{empty}</Empty>}
      </div>
      <div className="table-footer">
        <span>
          {rows.length
            ? `${p * pageSize + 1}–${Math.min((p + 1) * pageSize, rows.length)} de ${rows.length} registos`
            : "0 registos"}
        </span>
        {pages > 1 && (
          <div className="pagination">
            <button
              aria-label="Página anterior"
              disabled={!p}
              onClick={() => setPage(p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {p + 1} / {pages}
            </span>
            <button
              aria-label="Página seguinte"
              disabled={p >= pages - 1}
              onClick={() => setPage(p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Inbox size={26} />
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${drawer ? "drawer" : "modal"} ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Note({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <div className={`note ${tone}`}>{children}</div>;
}
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="detail-list">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
