"use client";
import { useId, useState } from "react";
import { money, num } from "@/lib/format";
export type ChartPoint = { label: string; value: number };
export function MonthlyChart({ points, bars = false, currency = false }: { points: ChartPoint[]; bars?: boolean; currency?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const format = (v: number) => currency ? money(v) : `${num(v, 2)} h`;
  if (!points.length) return <p className="panel-body muted">Sem registos no período.</p>;
  const low = Math.min(0, ...points.map(p => p.value));
  const high = Math.max(1, ...points.map(p => p.value));
  const x = (i: number) => 48 + (i + .5) * 520 / points.length;
  const y = (v: number) => 174 - (v - low) / (high - low) * 145;
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const chosen = active === null ? null : points[active];
  const previous = active !== null && active > 0 ? points[active - 1].value : null;
  return <div className="control-chart">
    <svg viewBox="0 0 600 210" role="img" aria-label={currency ? "Evolução mensal dos custos" : "Horas por mês"}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dd763a" stopOpacity=".14"/><stop offset="1" stopColor="#dd763a" stopOpacity=".01"/></linearGradient></defs>
      {[0, .5, 1].map(f => <g key={f}><line x1="48" x2="574" y1={29 + f * 145} y2={29 + f * 145} stroke="#eef0f2"/><text x="41" y={33 + f * 145} textAnchor="end">{num((high - f * (high-low))/ (currency ? 1000 : 1), 0)}{currency ? "k €" : ""}</text></g>)}
      {!bars && <><polygon points={`${x(0)},${y(0)} ${line} ${x(points.length-1)},${y(0)}`} fill={`url(#${id})`}/><polyline points={line} fill="none" stroke="#d9773c" strokeWidth="2.5" strokeLinejoin="round"/></>}
      {points.map((p, i) => <g key={p.label} tabIndex={0} role="button" aria-label={`${p.label}: ${format(p.value)}`} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
        {bars ? <rect x={x(i)-Math.min(14,180/points.length)} y={Math.min(y(0),y(p.value))} width={Math.min(28,360/points.length)} height={Math.max(1,Math.abs(y(p.value)-y(0)))} rx="3" fill="#cf9877"/> : <circle cx={x(i)} cy={y(p.value)} r={active === i ? 5 : 3} fill="#d9773c"/>}
        <rect x={x(i)-260/points.length} y="20" width={520/points.length} height="160" fill="transparent"/>
        {(points.length <= 12 || i % Math.ceil(points.length / 10) === 0) && <text x={x(i)} y="199" textAnchor="middle">{new Date(p.label+"-01T12:00:00").toLocaleDateString("pt-PT", {month:"short"})}{points.length > 12 ? ` ${p.label.slice(2,4)}` : ""}</text>}
      </g>)}
    </svg>
    <div className="chart-tooltip" aria-live="polite">{chosen ? <><b>{new Date(chosen.label+"-01T12:00:00").toLocaleDateString("pt-PT",{month:"long",year:"numeric"})} · {format(chosen.value)}</b><span>{previous === null ? "Sem mês anterior no período" : previous === 0 ? "Mês anterior sem valor para comparação" : `${chosen.value >= previous ? "+" : ""}${num((chosen.value-previous)/Math.abs(previous)*100)}% face ao mês anterior`}</span></> : <span>Passe sobre um mês ou selecione-o com Tab para ver o detalhe.</span>}</div>
  </div>;
}
export function Ranking({ points, onSelect, currency = true }: { points: (ChartPoint & { risk?: boolean })[]; onSelect?: (label: string) => void; currency?: boolean }) {
  const max = Math.max(1, ...points.map(p => p.value));
  return <div className="control-ranking">{points.length ? points.map(p => <button key={p.label} disabled={!onSelect} onClick={() => onSelect?.(p.label)} className="ranking-item"><span>{p.label}{p.risk && <small className="ranking-risk">Em risco</small>}</span><div className="ranking-track"><i style={{width:`${Math.max(0,p.value/max*100)}%`}}/></div><b>{currency ? money(p.value) : `${num(p.value,2)} h`}</b></button>) : <p className="muted">Sem registos no período.</p>}</div>;
}
