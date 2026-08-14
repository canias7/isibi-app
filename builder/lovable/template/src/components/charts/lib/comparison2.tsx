/** Comparison charts and statistical diagnostics. */

const TONE = "var(--foreground)";
import { SHADE, inkOn, shadePct } from "./_ink";

/* -------------------------------------------------------- Cleveland dots */
/** A dot plot: less ink than a bar and no baseline to anchor to zero. */
export function ClevelandDotPlot({
  items, rowHeight = 26, min, max, format = (n: number) => String(n), label,
}: {
  items: { label: string; value: number }[]; rowHeight?: number;
  min?: number; max?: number; format?: (n: number) => string; label?: string;
}) {
  const rows = [...items].sort((a, b) => b.value - a.value);
  if (!rows.length) return null;
  const lo = min ?? Math.min(...rows.map((r) => r.value));
  const hi = max ?? Math.max(...rows.map((r) => r.value));
  const pad = (hi - lo) * 0.08 || 1;
  const X = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} items`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2" style={{ height: rowHeight }}>
          <span className="w-20 shrink-0 truncate text-right text-[10px] text-muted-foreground">{r.label}</span>
          <div className="relative h-full flex-1">
            <div className="absolute top-1/2 right-0 left-0 border-t border-dotted border-border" />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${X(r.value)}%`, background: TONE }} />
          </div>
          <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Two series per row as dots — the grouped form. */
export function GroupedDotPlot({
  items, seriesLabels = ["A", "B"], rowHeight = 28, format = (n: number) => String(n), label,
}: {
  items: { label: string; a: number; b: number }[];
  seriesLabels?: [string, string] | string[]; rowHeight?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!items.length) return null;
  const all = items.flatMap((i) => [i.a, i.b]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.1 || 1;
  const X = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${items.length} items, two series`}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2" style={{ height: rowHeight }}>
          <span className="w-20 shrink-0 truncate text-right text-[10px] text-muted-foreground">{it.label}</span>
          <div className="relative h-full flex-1">
            <div className="absolute top-1/2 right-0 left-0 border-t border-dotted border-border" />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{ left: `${X(it.a)}%`, background: "var(--background)", borderColor: TONE }} />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${X(it.b)}%`, background: TONE }} />
          </div>
        </div>
      ))}
      <p className="mt-1 text-[10px] text-muted-foreground">
        ○ {seriesLabels[0]} · ● {seriesLabels[1]} · {format(lo)}–{format(hi)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ index chart */
/**
 * Every series rebased so its first point is 100.
 *
 * The only honest way to compare growth between things of wildly different
 * size — on raw values the big series is the only one you can see.
 */
export function IndexChart({
  series, periods, base = 100, height = 230, label,
}: {
  series: { label: string; values: number[] }[]; periods: string[];
  base?: number; height?: number; label?: string;
}) {
  if (!series.length) return null;
  const idx = series.map((s) => ({ label: s.label, values: s.values.map((v) => (v / (s.values[0] || 1)) * base) }));
  const all = idx.flatMap((s) => s.values);
  const lo = Math.min(...all, base), hi = Math.max(...all, base);
  const X = (i: number) => (i / (periods.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${series.length} series rebased to ${base}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={Y(base)} y2={Y(base)} stroke="var(--border)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          {idx.map((s, i) => (
            <polyline key={s.label} points={s.values.map((v, k) => `${X(k)},${Y(v)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={i === 0 ? 2.2 : 1.1}
              strokeOpacity={i === 0 ? 1 : 0.4} strokeDasharray={i === 0 ? undefined : "4 3"}
              vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {idx.map((s) => (
          <span key={`${s.label}-end`} className="absolute -translate-y-1/2 pl-1 text-[10px] whitespace-nowrap text-muted-foreground"
            style={{ left: "100%", top: `${Y(s.values[s.values.length - 1])}%` }}>
            {s.label} {Math.round(s.values[s.values.length - 1])}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">All rebased to {base} at {periods[0]}</p>
    </div>
  );
}

/* -------------------------------------------------------------- log line */
/** A line on a log y-axis — constant growth RATE becomes a straight line. */
export function LogLine({
  series, periods, height = 230, label,
}: {
  series: { label: string; values: number[] }[]; periods: string[]; height?: number; label?: string;
}) {
  if (!series.length) return null;
  const all = series.flatMap((s) => s.values).filter((v) => v > 0);
  const lgLo = Math.log(Math.min(...all)), lgHi = Math.log(Math.max(...all));
  const X = (i: number) => (i / (periods.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((Math.log(Math.max(v, 1e-6)) - lgLo) / (lgHi - lgLo || 1)) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? "Series on a log scale"}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {series.map((s, i) => (
            <polyline key={s.label} points={s.values.map((v, k) => `${X(k)},${Y(v)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={i === 0 ? 2 : 1.2} strokeOpacity={i === 0 ? 1 : 0.45}
              strokeDasharray={i === 0 ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Log scale — a straight line is a constant growth rate, not a constant amount
      </p>
    </div>
  );
}

/* -------------------------------------------------------- percent change */
/** Change per category, diverging about zero, with the sign spelled out. */
export function PercentChangeBar({
  items, rowHeight = 26, label,
}: {
  items: { label: string; change: number }[]; rowHeight?: number; label?: string;
}) {
  const rows = [...items].sort((a, b) => b.change - a.change);
  if (!rows.length) return null;
  const reach = Math.max(...rows.map((r) => Math.abs(r.change))) || 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} changes`}>
      <div className="relative" style={{ height: rows.length * rowHeight }}>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        {rows.map((r, i) => {
          const w = (Math.abs(r.change) / reach) * 44;
          const up = r.change >= 0;
          return (
            <div key={r.label}>
              <div className="absolute rounded-[2px]"
                style={{
                  top: i * rowHeight + rowHeight * 0.2, height: rowHeight * 0.6,
                  left: up ? "50%" : `${50 - w}%`, width: `${w}%`,
                  background: TONE, opacity: up ? 0.85 : 0.3,
                  border: up ? undefined : `1px solid ${TONE}`,
                }} />
              <span className="absolute text-[10px] whitespace-nowrap text-muted-foreground"
                style={{ top: i * rowHeight + rowHeight * 0.22, left: up ? `calc(50% + ${w}% + 4px)` : `calc(${50 - w}% - 4px)`, transform: up ? undefined : "translateX(-100%)" }}>
                {r.label} {up ? "↑" : "↓"}{Math.abs(r.change)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bubble grid */
/** A categorical grid where the dot size is the number. */
export function BubbleGrid({
  rows, cols, values, cell = 46, format = (n: number) => String(n), label,
}: {
  rows: string[]; cols: string[]; values: number[][]; cell?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!rows.length) return null;
  const hi = Math.max(...values.flat()) || 1;
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${rows.length} by ${cols.length} grid`}>
      <table style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => <th key={c} className="pb-1 text-[10px] font-normal text-muted-foreground" style={{ width: cell }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                // Area, not diameter.
                const d = v ? 5 + Math.sqrt(v / hi) * (cell - 12) : 0;
                return (
                  <td key={c} className="text-center" style={{ width: cell, height: cell }}>
                    {d ? <span className="inline-block rounded-full align-middle" style={{ width: d, height: d, background: TONE, opacity: 0.75 }}
                      title={`${r} · ${c}: ${format(v)}`} /> : null}
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

/* ----------------------------------------------------------- tally chart */
/** Five-bar gates. Countable at a glance, which is the whole idea. */
export function TallyChart({
  rows, label,
}: {
  rows: { label: string; count: number }[]; label?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="w-full space-y-2" role="img" aria-label={label ?? rows.map((r) => `${r.label} ${r.count}`).join(", ")}>
      {rows.map((r) => {
        const gates = Math.floor(r.count / 5);
        const rest = r.count % 5;
        return (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-right text-[10px] text-muted-foreground">{r.label}</span>
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: gates }, (_, g) => (
                <svg key={g} width={20} height={16} viewBox="0 0 20 16">
                  {[0, 4, 8, 12].map((x) => <line key={x} x1={x + 2} y1={1} x2={x + 2} y2={15} stroke={TONE} strokeWidth={1.4} />)}
                  <line x1={0} y1={14} x2={18} y2={2} stroke={TONE} strokeWidth={1.4} />
                </svg>
              ))}
              {rest ? (
                <svg width={rest * 4 + 2} height={16} viewBox={`0 0 ${rest * 4 + 2} 16`}>
                  {Array.from({ length: rest }, (_, i) => <line key={i} x1={i * 4 + 2} y1={1} x2={i * 4 + 2} y2={15} stroke={TONE} strokeWidth={1.4} />)}
                </svg>
              ) : null}
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{r.count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ delta bars */
/** Before and after as a connected pair, with the gap as the bar. */
export function DeltaBars({
  items, rowHeight = 30, format = (n: number) => String(n), label,
}: {
  items: { label: string; before: number; after: number }[]; rowHeight?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!items.length) return null;
  const all = items.flatMap((i) => [i.before, i.after]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const X = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${items.length} before-and-after pairs`}>
      {items.map((it) => {
        const a = X(it.before), b = X(it.after);
        const up = it.after >= it.before;
        return (
          <div key={it.label} className="flex items-center gap-2" style={{ height: rowHeight }}>
            <span className="w-20 shrink-0 truncate text-right text-[10px] text-muted-foreground">{it.label}</span>
            <div className="relative h-full flex-1">
              <div className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%`, background: TONE, opacity: up ? 0.55 : 0.2, border: up ? undefined : `1px solid ${TONE}` }} />
              <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ left: `${a}%`, background: "var(--background)", borderColor: TONE }} />
              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${b}%`, background: TONE }} />
            </div>
            <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {up ? "↑" : "↓"}{format(Math.abs(it.after - it.before))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- mosaic plot */
/**
 * A contingency table where BOTH dimensions are to scale: column width is the
 * marginal, segment height the conditional.
 *
 * Different from marimekko only in intent — this one is for categorical
 * association, so the interesting thing is where the splits fail to line up.
 */
export function MosaicPlot({
  cols, rowLabels, values, height = 240, gap = 3, label,
}: {
  cols: string[]; rowLabels: string[]; /** values[col][row] */ values: number[][];
  height?: number; gap?: number; label?: string;
}) {
  if (!cols.length) return null;
  const colTotals = values.map((c) => c.reduce((s, v) => s + v, 0));
  const grand = colTotals.reduce((s, v) => s + v, 0) || 1;
  const tone = (i: number) => `color-mix(in oklch, var(--foreground) ${Math.round(88 - (i / Math.max(1, rowLabels.length - 1)) * 74)}%, transparent)`;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${cols.length} by ${rowLabels.length} contingency`}>
      <div className="flex w-full" style={{ height, gap }}>
        {cols.map((c, ci) => (
          <div key={c} className="flex flex-col" style={{ width: `${(colTotals[ci] / grand) * 100}%` }}>
            {rowLabels.map((r, ri) => (
              <div key={r} className="flex items-center justify-center overflow-hidden text-[9px]"
                style={{
                  height: `${((values[ci][ri] ?? 0) / (colTotals[ci] || 1)) * 100}%`,
                  background: tone(ri), color: ri === 0 ? "var(--background)" : "var(--foreground)",
                }}
                title={`${c} · ${r}: ${values[ci][ri]}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex w-full" style={{ gap }}>
        {cols.map((c, ci) => (
          <div key={c} className="truncate pt-1 text-center text-[10px] text-muted-foreground" style={{ width: `${(colTotals[ci] / grand) * 100}%` }}>{c}</div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {rowLabels.map((r, ri) => (
          <span key={r} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: tone(ri) }} />{r}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- P-P plot */
/** Cumulative probabilities against each other. Sensitive in the middle. */
export function PPPlot({ values, size = 240, label }: { values: number[]; size?: number; label?: string }) {
  if (values.length < 2) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
  // Zelen & Severo's normal CDF approximation — plenty for a plot.
  const cdf = (z: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  };
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `Probability-probability plot of ${n} values`}>
        <line x1={0} y1={100} x2={100} y2={0} stroke="var(--border)" strokeDasharray="3 3" />
        {s.map((v, i) => (
          <circle key={i} cx={cdf((v - mean) / sd) * 100} cy={100 - ((i + 0.5) / n) * 100} r={1.5} fill={TONE} fillOpacity={0.7} />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------ bootstrap CI */
/** A resampled statistic's distribution, with the interval marked. */
export function BootstrapCI({
  samples, ciLow, ciHigh, observed, bins = 28, height = 210,
  format = (n: number) => n.toFixed(2), label,
}: {
  samples: number[]; ciLow?: number; ciHigh?: number; observed?: number;
  bins?: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!samples.length) return null;
  const s = [...samples].sort((a, b) => a - b);
  const lo = s[0], hi = s[s.length - 1];
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0) as number[];
  for (const v of s) counts[v === hi ? bins - 1 : Math.floor((v - lo) / w)]++;
  const peak = Math.max(...counts) || 1;
  const lowV = ciLow ?? s[Math.floor(s.length * 0.025)];
  const highV = ciHigh ?? s[Math.floor(s.length * 0.975)];
  const X = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Bootstrap interval ${format(lowV)} to ${format(highV)}`}>
      <div className="relative flex w-full items-end" style={{ height }}>
        <div className="absolute top-0 bottom-0" style={{ left: `${X(lowV)}%`, width: `${X(highV) - X(lowV)}%`, background: TONE, opacity: 0.08 }} />
        {counts.map((c, i) => {
          const centre = lo + (i + 0.5) * w;
          const inside = centre >= lowV && centre <= highV;
          return <div key={i} className="relative flex-1" style={{ height: `${(c / peak) * 100}%`, background: TONE, opacity: inside ? 0.85 : 0.28 }} />;
        })}
        {observed !== undefined ? (
          <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${X(observed)}%` }} title={`Observed ${format(observed)}`} />
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        95% interval {format(lowV)} to {format(highV)}{observed !== undefined ? ` · observed ${format(observed)}` : ""}
      </p>
    </div>
  );
}

/* -------------------------------------------------------- influence plot */
/** Leverage against residual, bubble by Cook's distance. */
export function InfluencePlot({
  points, height = 230, label,
}: {
  points: { leverage: number; residual: number; cooks: number; label?: string }[];
  height?: number; label?: string;
}) {
  if (!points.length) return null;
  const hLo = 0, hHi = Math.max(...points.map((p) => p.leverage)) * 1.1 || 1;
  const rBound = Math.max(...points.map((p) => Math.abs(p.residual))) * 1.1 || 1;
  const cMax = Math.max(...points.map((p) => p.cooks)) || 1;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }} role="img" aria-label={label ?? `${points.length} observations by influence`}>
        <div className="absolute top-1/2 right-0 left-0 border-t border-border" />
        {[-2, 2].map((z) => (
          <div key={z} className="absolute right-0 left-0 border-t border-dashed border-border" style={{ top: `${50 - (z / rBound) * 46}%` }} />
        ))}
        {points.map((p, i) => {
          const d = 4 + Math.sqrt(p.cooks / cMax) * 18;
          return (
            <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                left: `${((p.leverage - hLo) / (hHi - hLo)) * 96 + 2}%`,
                top: `${50 - (p.residual / rBound) * 46}%`,
                width: d, height: d, background: TONE, opacity: 0.22, borderColor: TONE,
              }} title={p.label ?? `Cook's ${p.cooks.toFixed(3)}`} />
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Leverage across, residual up, bubble is Cook&rsquo;s distance</p>
    </div>
  );
}

/* ---------------------------------------------------- scale-location plot */
/** Root absolute residual against fitted — checks for changing spread. */
export function ScaleLocation({
  points, height = 210, label,
}: {
  points: { fitted: number; residual: number }[]; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const pts = points.map((p) => ({ x: p.fitted, y: Math.sqrt(Math.abs(p.residual)) }));
  const xLo = Math.min(...pts.map((p) => p.x)), xHi = Math.max(...pts.map((p) => p.x));
  const yHi = Math.max(...pts.map((p) => p.y)) || 1;
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 100;
  const Y = (v: number) => 100 - (v / yHi) * 92 - 4;

  // Binned means give the trend line without a smoother.
  const bins = 10;
  const means = Array.from({ length: bins }, (_, i) => {
    const from = xLo + ((xHi - xLo) * i) / bins, to = xLo + ((xHi - xLo) * (i + 1)) / bins;
    const inside = pts.filter((p) => p.x >= from && p.x <= to);
    return inside.length ? { x: (from + to) / 2, y: inside.reduce((s, p) => s + p.y, 0) / inside.length } : null;
  }).filter(Boolean) as { x: number; y: number }[];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }} role="img" aria-label={label ?? "Spread against fitted value"}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={means.map((m) => `${X(m.x)},${Y(m.y)}`).join(" ")} fill="none" stroke={TONE} strokeOpacity={0.6} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map((p, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${X(p.x)}%`, top: `${Y(p.y)}%`, background: TONE, opacity: 0.5 }} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">A flat line means the spread is steady</p>
    </div>
  );
}

/* ------------------------------------------------- partial dependence plot */
/** What the model predicts as one input moves, everything else held still. */
export function PartialDependence({
  points, rug, height = 220, format = (n: number) => n.toFixed(1), label,
}: {
  points: { x: number; y: number }[]; rug?: number[]; height?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!points.length) return null;
  const xLo = Math.min(...points.map((p) => p.x)), xHi = Math.max(...points.map((p) => p.x));
  const yLo = Math.min(...points.map((p) => p.y)), yHi = Math.max(...points.map((p) => p.y));
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 100;
  const Y = (v: number) => 100 - ((v - yLo) / (yHi - yLo || 1)) * 92 - 4;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }} role="img" aria-label={label ?? "Partial dependence"}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={points.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {/* The rug matters here: the curve is meaningless where there is no
          data, and without it a confident-looking line over an empty region
          is exactly what gets over-interpreted. */}
      {rug?.length ? (
        <div className="relative mt-1 h-3 w-full border-t border-border">
          {rug.map((v, i) => (
            <span key={i} className="absolute top-0 w-px" style={{ left: `${X(v)}%`, height: 8, background: TONE, opacity: 0.35 }} />
          ))}
        </div>
      ) : null}
      <p className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(xLo)}</span><span>ticks are where the data actually is</span><span>{format(xHi)}</span>
      </p>
    </div>
  );
}

export { SHADE };
