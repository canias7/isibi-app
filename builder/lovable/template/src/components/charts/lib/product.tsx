/** Product and web analytics charts. */

const TONE = "var(--foreground)";
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${Math.round(8 + t * 84)}%, var(--muted))`;

/* ------------------------------------------------------- network waterfall */
/**
 * The browser's request timeline: one row per resource, phases within the bar.
 *
 * Phases are told apart by FILL WEIGHT, not colour, and the bar starts where
 * the request did — the staircase is the whole diagnosis, because a flat left
 * edge means parallel and a diagonal one means blocked.
 */
export function NetworkWaterfall({
  requests, rowHeight = 20, labelWidth = 130, marks, label,
}: {
  requests: { name: string; start: number; wait: number; download: number }[];
  rowHeight?: number; labelWidth?: number;
  /** Vertical guides, e.g. DOMContentLoaded. */ marks?: { at: number; label: string }[];
  label?: string;
}) {
  if (!requests.length) return null;
  const end = Math.max(...requests.map((r) => r.start + r.wait + r.download));
  const X = (t: number) => (t / (end || 1)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${requests.length} requests over ${Math.round(end)}ms`}>
      <div className="flex">
        <div style={{ width: labelWidth }} className="shrink-0" />
        <div className="relative flex-1 pb-1">
          {(marks ?? []).map((m) => (
            <span key={m.label} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground" style={{ left: `${X(m.at)}%` }}>{m.label}</span>
          ))}
        </div>
      </div>
      <div className="flex">
        <div style={{ width: labelWidth }} className="shrink-0">
          {requests.map((r) => (
            <div key={r.name} style={{ height: rowHeight }} className="flex items-center pr-2 text-[10px] text-muted-foreground">
              <span className="truncate">{r.name}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: requests.length * rowHeight }}>
          {(marks ?? []).map((m) => (
            <div key={m.label} className="absolute top-0 bottom-0 border-l border-dashed border-border" style={{ left: `${X(m.at)}%` }} />
          ))}
          {requests.map((r, i) => (
            <div key={r.name}>
              <div className="absolute rounded-l-[2px]"
                style={{ left: `${X(r.start)}%`, width: `${X(r.wait)}%`, top: i * rowHeight + 4, height: rowHeight - 8, background: TONE, opacity: 0.25 }}
                title={`${r.name}: waited ${Math.round(r.wait)}ms`} />
              <div className="absolute rounded-r-[2px]"
                style={{ left: `${X(r.start + r.wait)}%`, width: `${X(r.download)}%`, top: i * rowHeight + 4, height: rowHeight - 8, background: TONE }}
                title={`${r.name}: downloaded in ${Math.round(r.download)}ms`} />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Faint is waiting, solid is transfer · {Math.round(end)}ms total</p>
    </div>
  );
}

/* ------------------------------------------------------------ scroll depth */
/** How far down the page people actually get. */
export function ScrollDepth({
  buckets, height = 230, sections, label,
}: {
  /** Share still on the page at each depth, 0-1. */ buckets: number[];
  height?: number; sections?: { at: number; label: string }[]; label?: string;
}) {
  if (!buckets.length) return null;
  const rowH = height / buckets.length;
  return (
    <div className="w-full" role="img" aria-label={label ?? `${Math.round(buckets[buckets.length - 1] * 100)}% reach the bottom`}>
      <div className="relative" style={{ height }}>
        {buckets.map((b, i) => (
          <div key={i} className="absolute left-0 flex items-center rounded-r-[2px] pl-2 text-[9px]"
            style={{ top: i * rowH, height: rowH - 1, width: `${b * 100}%`, background: SHADE(b), color: b > 0.5 ? "var(--background)" : "var(--foreground)" }}
            title={`${Math.round(((i + 1) / buckets.length) * 100)}% down: ${Math.round(b * 100)}% still here`}>
            {Math.round(((i + 1) / buckets.length) * 100)}%
          </div>
        ))}
        {(sections ?? []).map((s) => (
          <span key={s.label} className="absolute right-0 -translate-y-1/2 text-[9px] text-muted-foreground"
            style={{ top: s.at * height }}>{s.label}</span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {Math.round(buckets[buckets.length - 1] * 100)}% reach the bottom
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- click grid */
/** Where the clicks land, as a coarse grid over the page. */
export function ClickGrid({
  grid, width = 260, aspect = 1.4, label,
}: {
  /** grid[row][col] click counts. */ grid: number[][]; width?: number; aspect?: number; label?: string;
}) {
  if (!grid.length) return null;
  const rows = grid.length, cols = grid[0].length;
  const hi = Math.max(...grid.flat()) || 1;
  const cw = width / cols, ch = (width * aspect) / rows;

  return (
    <div className="w-full">
      <div className="relative rounded-[3px] border border-border" style={{ width, height: width * aspect }}
        role="img" aria-label={label ?? `Clicks across a ${rows} by ${cols} grid`}>
        {grid.map((r, ri) =>
          r.map((v, ci) => (
            <div key={`${ri}-${ci}`} className="absolute"
              style={{ left: ci * cw, top: ri * ch, width: cw, height: ch, background: TONE, opacity: (v / hi) * 0.72 }}
              title={`${v} clicks`} />
          ))
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Darker is more clicks · peak {hi}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- path tree */
/**
 * Where people went from a starting page, as an indented tree with widths.
 *
 * A tree rather than a Sankey because the question is "what did people do
 * NEXT", and a Sankey's crossing ribbons make a single dominant path harder
 * to follow, not easier.
 */
export type PathNode = { label: string; value: number; children?: PathNode[] };

export function PathTree({
  root, rowHeight = 26, indent = 18, label,
}: {
  root: PathNode; rowHeight?: number; indent?: number; label?: string;
}) {
  const rows: { node: PathNode; depth: number }[] = [];
  const walk = (n: PathNode, d: number) => {
    rows.push({ node: n, depth: d });
    [...(n.children ?? [])].sort((a, b) => b.value - a.value).forEach((c) => walk(c, d + 1));
  };
  walk(root, 0);
  const hi = root.value || 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} steps from ${root.label}`}>
      {rows.map((r, i) => (
        <div key={`${r.node.label}-${i}`} className="flex items-center gap-2" style={{ height: rowHeight, paddingLeft: r.depth * indent }}>
          <span className="w-28 shrink-0 truncate text-[10px]" style={{ opacity: 1 - r.depth * 0.16 }}>{r.node.label}</span>
          <div className="h-3 flex-1 rounded-[2px] bg-muted">
            <div className="h-full rounded-[2px]" style={{ width: `${(r.node.value / hi) * 100}%`, background: TONE, opacity: 1 - r.depth * 0.18 }} />
          </div>
          <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {r.node.value.toLocaleString()} · {Math.round((r.node.value / hi) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ adoption curve */
/** Share of the base using a feature, with the launch marked. */
export function AdoptionCurve({
  points, launchAt, height = 220, label,
}: {
  points: { label: string; share: number }[]; launchAt?: number; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const X = (i: number) => (i / (points.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - v * 94 - 3;
  const last = points[points.length - 1];

  return (
    <div className="w-full" role="img" aria-label={label ?? `${Math.round(last.share * 100)}% adoption`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${points.map((p, i) => `${X(i)},${Y(p.share)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.14} />
          <polyline points={points.map((p, i) => `${X(i)},${Y(p.share)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {launchAt !== undefined ? (
          <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${X(launchAt)}%` }} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0].label}</span>
        <span>{Math.round(last.share * 100)}% of the base</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ A/B test plot */
/**
 * Two arms with their intervals, and the difference below.
 *
 * The DIFFERENCE is the chart, not the two rates: overlapping intervals on the
 * arms do not mean no effect, and showing only the arms is how that mistake
 * gets made.
 */
export function AbTestResult({
  arms, difference, format = (n: number) => (n * 100).toFixed(1) + "%", label,
}: {
  arms: { label: string; rate: number; low: number; high: number; n: number }[];
  difference: { estimate: number; low: number; high: number };
  format?: (n: number) => string; label?: string;
}) {
  if (arms.length < 2) return null;
  const lo = Math.min(...arms.map((a) => a.low));
  const hi = Math.max(...arms.map((a) => a.high));
  const pad = (hi - lo) * 0.15 || 0.01;
  const X = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;

  const dLo = Math.min(0, difference.low), dHi = Math.max(0, difference.high);
  const dPad = (dHi - dLo) * 0.15 || 0.01;
  const DX = (v: number) => ((v - dLo + dPad) / (dHi - dLo + dPad * 2)) * 100;
  const clears = difference.low > 0 || difference.high < 0;

  return (
    <div className="w-full" role="img" aria-label={label ?? (clears ? "The interval clears zero" : "The interval spans zero")}>
      {arms.map((a) => (
        <div key={a.label} className="flex items-center gap-2 py-1">
          <span className="w-16 shrink-0 truncate text-right text-[10px] text-muted-foreground">{a.label}</span>
          <div className="relative h-5 flex-1">
            <div className="absolute top-1/2 h-px" style={{ left: `${X(a.low)}%`, width: `${X(a.high) - X(a.low)}%`, background: TONE }} />
            <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${X(a.rate)}%`, background: TONE }} />
          </div>
          <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{format(a.rate)} · n={a.n}</span>
        </div>
      ))}
      <div className="mt-2 border-t border-border pt-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-right text-[10px] font-medium">Difference</span>
          <div className="relative h-5 flex-1">
            <div className="absolute top-0 bottom-0 border-l border-dashed border-border" style={{ left: `${DX(0)}%` }} />
            <div className="absolute top-1/2 h-px" style={{ left: `${DX(difference.low)}%`, width: `${DX(difference.high) - DX(difference.low)}%`, background: TONE }} />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45" style={{ left: `${DX(difference.estimate)}%`, background: TONE }} />
          </div>
          <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{format(difference.estimate)}</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {clears ? "The interval clears zero — a real difference" : "The interval spans zero — not yet conclusive"}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- engagement matrix */
/** Frequency against depth, sized by how many people are in each cell. */
export function EngagementMatrix({
  rows, cols, values, cell = 46, label,
}: {
  rows: string[]; cols: string[]; values: number[][]; cell?: number; label?: string;
}) {
  if (!rows.length) return null;
  const total = values.flat().reduce((s, v) => s + v, 0) || 1;
  const hi = Math.max(...values.flat()) || 1;
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${total} people across a ${rows.length} by ${cols.length} grid`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => <th key={c} className="pb-1 text-[9px] font-normal text-muted-foreground" style={{ width: cell }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[9px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                return (
                  <td key={c} className="p-0">
                    <div className="flex flex-col items-center justify-center rounded-[3px] leading-none"
                      style={{ width: cell, height: cell, background: SHADE(v / hi), color: v / hi > 0.45 ? "var(--background)" : "var(--foreground)" }}
                      title={`${r} · ${c}: ${v}`}>
                      <span className="text-[10px] tabular-nums">{v}</span>
                      <span className="text-[8px] opacity-70">{Math.round((v / total) * 100)}%</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- step funnel */
/** Stages as bars with the drop-off between each spelled out. */
export function StepFunnel({
  steps, rowHeight = 46, label,
}: {
  steps: { label: string; value: number }[]; rowHeight?: number; label?: string;
}) {
  if (!steps.length) return null;
  const top = steps[0].value || 1;
  return (
    <div className="w-full" role="img" aria-label={label ?? `${Math.round((steps[steps.length - 1].value / top) * 100)}% reach the end`}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const dropped = prev !== null ? prev - s.value : 0;
        return (
          <div key={s.label}>
            {i > 0 ? (
              <div className="flex items-center gap-2 py-0.5 pl-24 text-[9px] text-muted-foreground">
                ↓ {dropped.toLocaleString()} left ({Math.round((dropped / (prev || 1)) * 100)}%)
              </div>
            ) : null}
            <div className="flex items-center gap-2" style={{ height: rowHeight }}>
              <span className="w-22 shrink-0 truncate text-right text-[10px] text-muted-foreground" style={{ width: 88 }}>{s.label}</span>
              <div className="h-7 flex-1 rounded-[2px] bg-muted">
                <div className="flex h-full items-center justify-end rounded-[2px] pr-2 text-[10px] tabular-nums"
                  style={{ width: `${(s.value / top) * 100}%`, background: TONE, color: "var(--background)" }}>
                  {s.value.toLocaleString()}
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {Math.round((s.value / top) * 100)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
