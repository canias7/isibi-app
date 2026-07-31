/** 2x2 grids, matrices and tabular charts. */

const TONE = "var(--foreground)";
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${Math.round(8 + t * 84)}%, var(--muted))`;

/* ------------------------------------------------------------- quadrant */
/**
 * The generic labelled 2x2. BCG, Eisenhower and a risk grid are all this
 * shape with different words on the axes, so they share one component —
 * three near-identical implementations is how the labels end up disagreeing.
 */
export function QuadrantMatrix({
  items, xLabel, yLabel, quadrants, size = 300, bubble = false, format = (n: number) => String(n), label,
}: {
  items: { label: string; x: number; y: number; size?: number }[];
  xLabel: string; yLabel: string;
  /** Clockwise from top-left. */
  quadrants?: [string, string, string, string];
  size?: number; bubble?: boolean; format?: (n: number) => string; label?: string;
}) {
  if (!items.length) return null;
  const maxS = Math.max(1, ...items.map((i) => i.size ?? 1));

  return (
    <div className="w-full" role="img" aria-label={label ?? `${items.length} items across ${xLabel} and ${yLabel}`}>
      <div className="flex">
        <div className="flex w-5 shrink-0 items-center justify-center">
          <span className="text-[10px] whitespace-nowrap text-muted-foreground" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {yLabel}
          </span>
        </div>
        <div className="relative flex-1 rounded-[3px] border border-border" style={{ height: size }}>
          <div className="absolute top-1/2 right-0 left-0 border-t border-dashed border-border" />
          <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-border" />
          {quadrants ? (
            <>
              <span className="absolute top-1.5 left-2 text-[10px] text-muted-foreground">{quadrants[0]}</span>
              <span className="absolute top-1.5 right-2 text-[10px] text-muted-foreground">{quadrants[1]}</span>
              <span className="absolute right-2 bottom-1.5 text-[10px] text-muted-foreground">{quadrants[2]}</span>
              <span className="absolute bottom-1.5 left-2 text-[10px] text-muted-foreground">{quadrants[3]}</span>
            </>
          ) : null}
          {items.map((it) => {
            const r = bubble ? 8 + Math.sqrt((it.size ?? 1) / maxS) * 22 : 9;
            return (
              <div key={it.label}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px]"
                style={{
                  left: `${it.x * 100}%`, top: `${(1 - it.y) * 100}%`,
                  width: r, height: r, background: TONE, color: "var(--background)",
                }}
                title={`${it.label}${it.size !== undefined ? `: ${format(it.size)}` : ""}`} />
            );
          })}
          {items.map((it) => (
            <span key={`${it.label}-t`} className="absolute -translate-x-1/2 text-[9px] whitespace-nowrap text-muted-foreground"
              style={{ left: `${it.x * 100}%`, top: `calc(${(1 - it.y) * 100}% + 10px)` }}>
              {it.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 pl-5 text-center text-[10px] text-muted-foreground">{xLabel}</p>
    </div>
  );
}

/* ---------------------------------------------------------- risk matrix */
/** Likelihood against impact, as a shaded grid with items placed in cells. */
export function RiskMatrix({
  items, levels = ["Low", "Medium", "High", "Severe"], cell = 74, label,
}: {
  items: { label: string; likelihood: number; impact: number }[];
  levels?: string[]; cell?: number; label?: string;
}) {
  const n = levels.length;
  const grid: Record<string, string[]> = {};
  for (const it of items) {
    const k = `${Math.min(n - 1, it.likelihood)}:${Math.min(n - 1, it.impact)}`;
    (grid[k] ||= []).push(it.label);
  }

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${items.length} risks by likelihood and impact`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <tbody>
          {Array.from({ length: n }, (_, r) => {
            const like = n - 1 - r;
            return (
              <tr key={like}>
                <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{levels[like]}</th>
                {Array.from({ length: n }, (_, imp) => {
                  // Severity is likelihood x impact, normalised — the corner
                  // furthest from the origin is the one to act on.
                  const t = ((like + 1) * (imp + 1)) / (n * n);
                  return (
                    <td key={imp} className="p-0 align-top">
                      <div className="overflow-hidden rounded-[3px] p-1 text-[9px] leading-tight"
                        style={{ width: cell, height: cell, background: SHADE(t), color: t > 0.45 ? "var(--background)" : "var(--foreground)" }}>
                        {(grid[`${like}:${imp}`] ?? []).map((l) => <div key={l} className="truncate">{l}</div>)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <th />
            {levels.map((l) => (
              <td key={l} className="pt-1 text-center text-[10px] text-muted-foreground">{l}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">Impact across, likelihood up</p>
    </div>
  );
}

/* ----------------------------------------------------- correlation matrix */
/**
 * Pairwise correlation. Sign is carried by FILL DIRECTION as well as shade —
 * positive is a solid square, negative is a ring — because a diverging colour
 * scale is exactly the encoding that fails in greyscale and for colour-blind
 * readers, and sign is the whole point here.
 */
export function CorrelationMatrix({
  keys, rows, cell = 46, labels, label,
}: {
  keys: string[]; rows: Record<string, number>[]; cell?: number;
  labels?: Record<string, string>; label?: string;
}) {
  if (!keys.length) return null;
  const corr = (a: string, b: string) => {
    const xs = rows.map((r) => Number(r[a])), ys = rows.map((r) => Number(r[b]));
    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return num / (Math.sqrt(dx * dy) || 1);
  };

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `Correlation across ${keys.length} measures`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {keys.map((k) => (
              <th key={k} className="pb-1 text-[9px] font-normal text-muted-foreground" style={{ width: cell }}>
                {(labels?.[k] ?? k).slice(0, 6)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((a) => (
            <tr key={a}>
              <th className="pr-2 text-right text-[9px] font-normal whitespace-nowrap text-muted-foreground">{labels?.[a] ?? a}</th>
              {keys.map((b) => {
                const r = a === b ? 1 : corr(a, b);
                const mag = Math.abs(r);
                return (
                  <td key={b} className="p-0">
                    <div className="flex items-center justify-center rounded-[2px] text-[9px] tabular-nums"
                      style={{
                        width: cell, height: cell,
                        background: r >= 0 ? SHADE(mag) : "var(--muted)",
                        border: r < 0 ? `${Math.max(1, mag * 5)}px solid ${TONE}` : undefined,
                        color: r >= 0 && mag > 0.45 ? "var(--background)" : "var(--foreground)",
                      }}
                      title={`${a} vs ${b}: ${r.toFixed(2)}`}>
                      {r.toFixed(1)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">Solid is positive · ringed is negative</p>
    </div>
  );
}

/* --------------------------------------------------- clustered heatmap */
/** A matrix with its rows reordered so similar rows sit together. */
export function ClusteredHeatmap({
  rowLabels, colLabels, values, cell = 30, label,
}: {
  rowLabels: string[]; colLabels: string[]; values: number[][]; cell?: number; label?: string;
}) {
  if (!rowLabels.length) return null;
  // Greedy nearest-neighbour ordering. Not hierarchical clustering, but it
  // achieves the actual goal — similar rows adjacent — deterministically and
  // without a dendrogram nobody reads.
  const dist = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  const order: number[] = [0];
  const left = new Set(values.map((_, i) => i).slice(1));
  while (left.size) {
    const last = values[order[order.length - 1]];
    let best = -1, bd = Infinity;
    for (const i of left) { const d = dist(last, values[i]); if (d < bd) { bd = d; best = i; } }
    order.push(best);
    left.delete(best);
  }
  const hi = Math.max(...values.flat()) || 1;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${rowLabels.length} rows clustered by similarity`}>
      <table className="border-separate" style={{ borderSpacing: 1 }}>
        <thead>
          <tr>
            <th />
            {colLabels.map((c) => <th key={c} className="pb-1 text-[9px] font-normal text-muted-foreground" style={{ width: cell }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {order.map((ri) => (
            <tr key={rowLabels[ri]}>
              <th className="pr-2 text-right text-[9px] font-normal whitespace-nowrap text-muted-foreground">{rowLabels[ri]}</th>
              {colLabels.map((c, ci) => (
                <td key={c} className="p-0">
                  <div className="rounded-[2px]" style={{ width: cell, height: cell, background: SHADE((values[ri][ci] ?? 0) / hi) }}
                    title={`${rowLabels[ri]} · ${c}: ${values[ri][ci]}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- scorecard */
/** Measures with target, actual and a status the reader can see at a glance. */
export function Scorecard({
  rows, label,
}: {
  rows: { label: string; value: number; target: number; format?: (n: number) => string; higherIsBetter?: boolean }[];
  label?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} measures against target`}>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border text-[10px] text-muted-foreground">
            <th className="py-1 text-left font-normal">Measure</th>
            <th className="py-1 text-right font-normal">Actual</th>
            <th className="py-1 text-right font-normal">Target</th>
            <th className="py-1 pl-3 text-left font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fmt = r.format ?? ((n: number) => n.toLocaleString());
            const better = r.higherIsBetter ?? true;
            const ratio = better ? r.value / (r.target || 1) : (r.target || 1) / (r.value || 1);
            // Glyph AND word, never a colour alone.
            const state = ratio >= 1 ? ["●", "met"] : ratio >= 0.9 ? ["◐", "close"] : ["○", "missed"];
            return (
              <tr key={r.label} className="border-b border-border/50">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(r.value)}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmt(r.target)}</td>
                <td className="py-1.5 pl-3">
                  <span className="mr-1">{state[0]}</span>
                  <span className="text-muted-foreground">{state[1]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------- variance table */
/** Actual against budget, with the gap drawn in the row. */
export function VarianceTable({
  rows, format = (n: number) => "£" + n.toLocaleString(), label,
}: {
  rows: { label: string; actual: number; budget: number }[];
  format?: (n: number) => string; label?: string;
}) {
  if (!rows.length) return null;
  const reach = Math.max(...rows.map((r) => Math.abs(r.actual - r.budget))) || 1;
  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} lines against budget`}>
      {rows.map((r) => {
        const v = r.actual - r.budget;
        const w = (Math.abs(v) / reach) * 48;
        return (
          <div key={r.label} className="flex items-center gap-2 border-b border-border/50 py-1.5 text-[11px]">
            <span className="w-24 shrink-0 truncate">{r.label}</span>
            <span className="w-16 shrink-0 text-right tabular-nums">{format(r.actual)}</span>
            <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{format(r.budget)}</span>
            <div className="relative h-3 flex-1">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
              <div className="absolute top-0 bottom-0 rounded-[2px]"
                style={{ left: v >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: TONE, opacity: v >= 0 ? 0.85 : 0.35, border: v < 0 ? `1px solid ${TONE}` : undefined }} />
            </div>
            <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {v >= 0 ? "+" : "−"}{format(Math.abs(v)).replace("£", "£")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- sparkline table */
/** A metric list where each row carries its own trend. */
export function SparklineTable({
  rows, label,
}: {
  rows: { label: string; value: string; series: number[]; delta?: string; up?: boolean }[];
  label?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} metrics with trends`}>
      {rows.map((r) => {
        const lo = Math.min(...r.series), hi = Math.max(...r.series);
        const span = hi - lo || 1;
        return (
          <div key={r.label} className="flex items-center gap-3 border-b border-border/50 py-2">
            <span className="w-28 shrink-0 truncate text-[11px]">{r.label}</span>
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-24 shrink-0">
              <polyline points={r.series.map((v, i) => `${(i / (r.series.length - 1 || 1)) * 100},${23 - ((v - lo) / span) * 22}`).join(" ")}
                fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="flex-1 text-right text-[12px] font-medium tabular-nums">{r.value}</span>
            {r.delta ? (
              <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {r.up === false ? "↓" : "↑"} {r.delta}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
