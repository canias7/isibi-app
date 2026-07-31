/** Composite layouts and text-shaped charts. */

import type { ReactNode } from "react";

const TONE = "var(--foreground)";

const spark = (values: number[], w = 100, h = 24) => {
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  return values.map((v, i) => `${(i / (values.length - 1 || 1)) * w},${h - 1 - ((v - lo) / span) * (h - 2)}`).join(" ");
};

/* ----------------------------------------------------------------- KPI row */
/** The header strip: a number, its movement, and its shape. */
export function KpiRow({
  items, columns = 4, label,
}: {
  items: { label: string; value: string; delta?: string; up?: boolean; series?: number[] }[];
  columns?: number; label?: string;
}) {
  if (!items.length) return null;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      role="img" aria-label={label ?? items.map((i) => `${i.label} ${i.value}`).join(", ")}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <div className="truncate text-[10px] text-muted-foreground">{it.label}</div>
          <div className="mt-0.5 text-[20px] leading-none font-semibold tabular-nums">{it.value}</div>
          <div className="mt-1 flex items-center gap-2">
            {it.delta ? (
              // Direction is an arrow AND a word-shaped sign, never colour.
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {it.up === false ? "↓" : "↑"} {it.delta}
              </span>
            ) : null}
            {it.series?.length ? (
              <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-4 flex-1">
                <polyline points={spark(it.series)} fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
              </svg>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- dashboard grid */
/** A tile layout with spans — the frame a dashboard is assembled into. */
export function DashboardGrid({
  tiles, columns = 4, rowHeight = 96, label,
}: {
  tiles: { label: string; span?: number; rows?: number; body?: ReactNode }[];
  columns?: number; rowHeight?: number; label?: string;
}) {
  if (!tiles.length) return null;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gridAutoRows: `${rowHeight}px` }}
      role="img" aria-label={label ?? `${tiles.length} tiles`}>
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 overflow-hidden rounded-[4px] border border-border p-2"
          style={{ gridColumn: `span ${Math.min(columns, t.span ?? 1)}`, gridRow: `span ${t.rows ?? 1}` }}>
          <div className="truncate text-[10px] text-muted-foreground">{t.label}</div>
          <div className="mt-1">{t.body}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- annotated chart */
/**
 * A line with callouts pinned to points on it.
 *
 * The annotations are the chart. A spike with no note beside it gets
 * re-explained in every meeting; written on, it is answered once.
 */
export function AnnotatedChart({
  values, notes, height = 240, label,
}: {
  values: number[]; notes: { at: number; text: string; above?: boolean }[];
  height?: number; label?: string;
}) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const X = (i: number) => (i / (values.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 84 - 8;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${notes.length} annotations`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polyline points={values.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </svg>
      {notes.map((n) => (
        <div key={n.text} className="absolute" style={{ left: `${X(n.at)}%`, top: `${Y(values[n.at])}%` }}>
          <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ borderColor: TONE, background: "var(--background)" }} />
          <span className="absolute w-28 -translate-x-1/2 text-center text-[9px] leading-tight text-muted-foreground"
            style={{ [n.above === false ? "top" : "bottom"]: 12 } as React.CSSProperties}>
            {n.text}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- sparkline matrix */
/** A grid of tiny charts on ONE shared scale — comparison by position. */
export function SparklineMatrix({
  rows, cols, series, panelHeight = 34, label,
}: {
  rows: string[]; cols: string[];
  /** series[row][col] */ series: number[][][]; panelHeight?: number; label?: string;
}) {
  if (!rows.length) return null;
  const all = series.flat(2);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${rows.length} by ${cols.length} sparklines on one scale`}>
      <table style={{ borderSpacing: 4, borderCollapse: "separate" }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => <th key={c} className="pb-1 text-[9px] font-normal text-muted-foreground">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[9px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {cols.map((c, ci) => (
                <td key={c} style={{ width: 76 }}>
                  <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: 76, height: panelHeight }}>
                    <polyline
                      points={(series[ri]?.[ci] ?? []).map((v, i, a) => `${(i / (a.length - 1 || 1)) * 100},${23 - ((v - lo) / span) * 22}`).join(" ")}
                      fill="none" stroke={TONE} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
                  </svg>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">One shared scale, so panels are comparable</p>
    </div>
  );
}

/* ------------------------------------------------------ progress ring grid */
/** Several completion rings at once. */
export function ProgressRingGrid({
  rings, columns = 4, size = 74, label,
}: {
  rings: { label: string; value: number; max?: number }[]; columns?: number; size?: number; label?: string;
}) {
  if (!rings.length) return null;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      role="img" aria-label={label ?? rings.map((r) => `${r.label} ${r.value}`).join(", ")}>
      {rings.map((r) => {
        const max = r.max ?? 100;
        const pct = Math.max(0, Math.min(1, r.value / (max || 1)));
        const rad = size / 2 - 6;
        const c = 2 * Math.PI * rad;
        return (
          <div key={r.label} className="flex flex-col items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="var(--muted)" strokeWidth={6} />
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={TONE} strokeWidth={6} strokeLinecap="round"
                strokeDasharray={`${pct * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
              <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={600} className="fill-foreground">
                {Math.round(pct * 100)}%
              </text>
            </svg>
            <span className="mt-1 truncate text-[10px] text-muted-foreground">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------- metric + distribution */
/**
 * A headline number with the distribution it came from underneath.
 *
 * A mean on its own is the most over-trusted number in any dashboard; putting
 * the spread beneath it costs one line and stops the average being read as
 * the typical case.
 */
export function MetricDistribution({
  label: title, value, values, bins = 20, height = 54, marker, note,
}: {
  label: string; value: string; values: number[]; bins?: number;
  height?: number; marker?: number; note?: string;
}) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0) as number[];
  for (const v of values) counts[v === hi ? bins - 1 : Math.floor((v - lo) / w)]++;
  const peak = Math.max(...counts) || 1;

  return (
    <div className="w-full" role="img" aria-label={`${title} ${value}`}>
      <div className="text-[10px] text-muted-foreground">{title}</div>
      <div className="mt-0.5 text-[24px] leading-none font-semibold tabular-nums">{value}</div>
      <div className="relative mt-2 flex items-end gap-[1px]" style={{ height }}>
        {counts.map((c, i) => <div key={i} className="flex-1" style={{ height: `${(c / peak) * 100}%`, background: TONE, opacity: 0.5 }} />)}
        {marker !== undefined ? (
          <div className="absolute top-0 bottom-0 w-px bg-foreground" style={{ left: `${((marker - lo) / (hi - lo || 1)) * 100}%` }} />
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{note ?? `${values.length} observations`}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- word tree */
/** What follows a phrase, branching by how often. */
export function WordTree({
  root, branches, width = 460, rowHeight = 24, label,
}: {
  root: string; branches: { text: string; value: number; children?: { text: string; value: number }[] }[];
  width?: number; rowHeight?: number; label?: string;
}) {
  if (!branches.length) return null;
  const rows: { text: string; value: number; depth: number }[] = [];
  [...branches].sort((a, b) => b.value - a.value).forEach((b) => {
    rows.push({ text: b.text, value: b.value, depth: 0 });
    [...(b.children ?? [])].sort((x, y) => y.value - x.value).forEach((c) => rows.push({ text: c.text, value: c.value, depth: 1 }));
  });
  const hi = Math.max(...rows.map((r) => r.value)) || 1;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `What follows "${root}"`} style={{ maxWidth: width }}>
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-[3px] px-2 py-1 text-[11px] font-medium" style={{ background: TONE, color: "var(--background)" }}>
          {root}
        </div>
        <div className="flex-1">
          {rows.map((r, i) => (
            <div key={`${r.text}-${i}`} className="flex items-center gap-2" style={{ height: rowHeight, paddingLeft: r.depth * 16 }}>
              <div className="h-px shrink-0 bg-border" style={{ width: 10 + r.depth * 6 }} />
              {/* Size carries frequency, the way a word tree normally does. */}
              <span className="truncate" style={{ fontSize: 9 + (r.value / hi) * 6, opacity: 0.5 + (r.value / hi) * 0.5 }}>{r.text}</span>
              <span className="text-[9px] tabular-nums text-muted-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- KWIC list */
/** Keyword in context: the term centred, with what surrounds it. */
export function KwicList({
  term, lines, label,
}: {
  term: string; lines: { before: string; after: string; source?: string }[]; label?: string;
}) {
  if (!lines.length) return null;
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${lines.length} uses of "${term}"`}>
      <div className="min-w-[440px] font-mono text-[10px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className="flex items-baseline gap-1 border-b border-border/40 py-1">
            <span className="flex-1 truncate text-right text-muted-foreground">{l.before}</span>
            <span className="shrink-0 px-1 font-semibold" style={{ background: "var(--muted)" }}>{term}</span>
            <span className="flex-1 truncate text-muted-foreground">{l.after}</span>
            {l.source ? <span className="w-14 shrink-0 truncate text-right text-[9px] opacity-60">{l.source}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- headcount pyramid */
/** People by level, widest at the bottom — or not, which is the point. */
export function HeadcountPyramid({
  levels, height = 240, label,
}: {
  levels: { label: string; count: number }[]; height?: number; label?: string;
}) {
  if (!levels.length) return null;
  const hi = Math.max(...levels.map((l) => l.count)) || 1;
  const rowH = height / levels.length;
  const topHeavy = levels[0].count > levels[levels.length - 1].count;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${levels.reduce((s, l) => s + l.count, 0)} people across ${levels.length} levels`}>
      <div className="relative" style={{ height }}>
        {levels.map((l, i) => (
          <div key={l.label}>
            <div className="absolute -translate-x-1/2 rounded-[2px]"
              style={{ left: "50%", width: `${(l.count / hi) * 92}%`, top: i * rowH + 2, height: rowH - 4, background: TONE, opacity: 0.8 }}
              title={`${l.label}: ${l.count}`} />
            <span className="absolute left-0 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: i * rowH + rowH / 2 }}>{l.label}</span>
            <span className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ top: i * rowH + rowH / 2 }}>{l.count}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {topHeavy ? "Top heavy — more seniors than juniors" : "Widest at the base"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------- milestone burnup */
/** Work done rising towards a scope line that can itself move. */
export function MilestoneBurnup({
  done, scope, milestones, height = 230, label,
}: {
  done: number[]; scope: number[];
  milestones?: { at: number; label: string }[]; height?: number; label?: string;
}) {
  if (!done.length) return null;
  const hi = Math.max(...scope, ...done) * 1.05 || 1;
  const X = (i: number) => (i / (done.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - (v / hi) * 96 - 2;
  const crept = scope[scope.length - 1] - scope[0];

  return (
    <div className="w-full" role="img" aria-label={label ?? `${done[done.length - 1]} of ${scope[scope.length - 1]} done`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={scope.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeOpacity={0.45} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          <polygon points={`0,100 ${done.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} ${X(done.length - 1)},100`} fill={TONE} fillOpacity={0.14} />
          <polyline points={done.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {(milestones ?? []).map((m) => (
          <div key={m.label} className="absolute top-0 bottom-0" style={{ left: `${X(m.at)}%` }}>
            <div className="h-full border-l border-dashed border-border" />
            <span className="absolute top-0 -translate-x-1/2 text-[9px] whitespace-nowrap text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Dashed is scope{crept > 0 ? ` — it grew by ${crept}` : ""} · solid is done
      </p>
    </div>
  );
}
