/** A second batch of time-series charts. */

import { inkOn, shadePct } from "./_ink";

const TONE = "var(--foreground)";
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${Math.round(8 + t * 84)}%, var(--muted))`;

/* ------------------------------------------------- cumulative flow (CFD) */
/**
 * Work in each state, stacked, over time. The WIDTH of a band is how long
 * something sits in that state — which is the number a kanban board is
 * actually trying to surface and the one nobody can read off the board.
 */
export function CumulativeFlow({
  states, periods, height = 240, label,
}: {
  states: { label: string; values: number[] }[];
  periods: string[]; height?: number; label?: string;
}) {
  if (!states.length) return null;
  const n = periods.length;
  const totals = Array.from({ length: n }, (_, i) => states.reduce((s, st) => s + st.values[i], 0));
  const peak = Math.max(...totals) || 1;
  const X = (i: number) => (i / (n - 1 || 1)) * 100;

  let base = Array(n).fill(0) as number[];
  const bands = states.map((st, si) => {
    const top = base.map((b, i) => b + st.values[i]);
    const poly = [
      ...top.map((v, i) => `${X(i)},${100 - (v / peak) * 100}`),
      ...base.map((v, i) => `${X(i)},${100 - (v / peak) * 100}`).reverse(),
    ].join(" ");
    base = top;
    return { label: st.label, poly, tone: SHADE(1 - si / Math.max(1, states.length - 1)) };
  });

  return (
    <div className="w-full" role="img" aria-label={label ?? `Work in ${states.length} states over ${n} periods`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {bands.map((b) => <polygon key={b.label} points={b.poly} fill={b.tone} />)}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {bands.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: b.tone }} />{b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------- seasonal decomposition */
/** Observed, trend, seasonal and remainder as stacked panels on one x-axis. */
export function SeasonalDecomposition({
  values, period = 12, panelHeight = 56, label,
}: {
  values: number[]; period?: number; panelHeight?: number; label?: string;
}) {
  if (values.length < period * 2) return null;
  const n = values.length;
  // Centred moving average of one full period is the classic trend estimate.
  const trend = values.map((_, i) => {
    const half = Math.floor(period / 2);
    if (i < half || i >= n - half) return null;
    let s = 0;
    for (let k = -half; k <= half; k++) s += values[i + k];
    return s / (half * 2 + 1);
  });
  const detr = values.map((v, i) => (trend[i] === null ? null : v - (trend[i] as number)));
  const seasonAvg = Array.from({ length: period }, (_, p) => {
    const vs = detr.filter((v, i) => v !== null && i % period === p) as number[];
    return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 0;
  });
  const seasonal = values.map((_, i) => seasonAvg[i % period]);
  const remainder = values.map((v, i) => (trend[i] === null ? 0 : v - (trend[i] as number) - seasonal[i]));

  const panel = (series: (number | null)[], name: string) => {
    const vs = series.filter((v): v is number => v !== null);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const span = hi - lo || 1;
    return (
      <div key={name} className="mb-1">
        <div className="text-[10px] text-muted-foreground">{name}</div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height: panelHeight }}>
          <polyline
            points={series.map((v, i) => (v === null ? null : `${(i / (n - 1)) * 100},${100 - ((v - lo) / span) * 96 - 2}`)).filter(Boolean).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full" role="img" aria-label={label ?? "Series split into trend, seasonal and remainder"}>
      {panel(values, "Observed")}
      {panel(trend, "Trend")}
      {panel(seasonal, "Seasonal")}
      {panel(remainder, "Remainder")}
    </div>
  );
}

/* ------------------------------------------------------------ YoY overlay */
/** Each year as its own line on a shared month axis. */
export function YoYOverlay({
  years, months, height = 220, label,
}: {
  years: { label: string; values: number[] }[]; months: string[]; height?: number; label?: string;
}) {
  if (!years.length) return null;
  const all = years.flatMap((y) => y.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${years.length} years overlaid`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {years.map((y, i) => {
            const latest = i === years.length - 1;
            return (
              <polyline key={y.label}
                points={y.values.map((v, k) => `${(k / (y.values.length - 1 || 1)) * 100},${100 - ((v - lo) / span) * 96 - 2}`).join(" ")}
                fill="none" stroke={TONE} strokeWidth={latest ? 2.2 : 1}
                strokeOpacity={latest ? 1 : 0.3} strokeDasharray={latest ? undefined : "4 3"}
                vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      </div>
      {/* Keyed by INDEX, not by the label: a month axis is legitimately
          ["J","F","M","A","M","J"…] and duplicate keys make React reuse the
          wrong node. */}
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {months.map((m, i) => <span key={`${m}-${i}`}>{m}</span>)}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
        {years.map((y, i) => (
          <span key={y.label}>{i === years.length - 1 ? "— " : "-- "}{y.label}</span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- bollinger band */
/** A moving average with a band at ±k standard deviations. */
export function BollingerBands({
  values, window = 8, k = 2, height = 220, label,
}: {
  values: number[]; window?: number; k?: number; height?: number; label?: string;
}) {
  if (values.length < window) return null;
  const n = values.length;
  const stats = values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    const m = slice.reduce((s, v) => s + v, 0) / window;
    const sd = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / window);
    return { m, up: m + k * sd, lo: m - k * sd };
  });
  const valid = stats.filter(Boolean) as { m: number; up: number; lo: number }[];
  const lo = Math.min(...values, ...valid.map((s) => s.lo));
  const hi = Math.max(...values, ...valid.map((s) => s.up));
  const span = hi - lo || 1;
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / span) * 96 - 2;

  const idx = stats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${n} points with a ${window}-period band`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={[
              ...idx.map((i) => `${X(i)},${Y(stats[i]!.up)}`),
              ...idx.map((i) => `${X(i)},${Y(stats[i]!.lo)}`).reverse(),
            ].join(" ")}
            fill={TONE} fillOpacity={0.1} />
          <polyline points={idx.map((i) => `${X(i)},${Y(stats[i]!.m)}`).join(" ")}
            fill="none" stroke={TONE} strokeOpacity={0.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <polyline points={values.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- drawdown */
/** How far below the running peak the series is. Always zero or negative. */
export function Drawdown({
  values, height = 200, format = (n: number) => n.toFixed(0) + "%", label,
}: {
  values: number[]; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!values.length) return null;
  let peak = -Infinity;
  const dd = values.map((v) => { peak = Math.max(peak, v); return ((v - peak) / (peak || 1)) * 100; });
  const worst = Math.min(...dd) || -1;
  const X = (i: number) => (i / (values.length - 1 || 1)) * 100;
  const Y = (v: number) => (v / worst) * 96;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Worst drawdown ${format(worst)}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,0 ${dd.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} 100,0`} fill={TONE} fillOpacity={0.16} />
          <polyline points={dd.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Deepest drawdown {format(worst)}</p>
    </div>
  );
}

/* ------------------------------------------------------------- punch card */
/** Day against hour, as dots sized by count. GitHub's old commit view. */
export function PunchCard({
  rows, cols, values, max = 22, label,
}: {
  rows: string[]; cols: string[]; values: number[][]; max?: number; label?: string;
}) {
  if (!rows.length) return null;
  const hi = Math.max(...values.flat()) || 1;
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `Activity by ${rows.length} rows and ${cols.length} columns`}>
      <table style={{ borderSpacing: 0 }}>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                // Area proportional to count — diameter would square it.
                const d = v ? 4 + Math.sqrt(v / hi) * (max - 4) : 0;
                return (
                  <td key={c} style={{ width: max + 4, height: max + 4 }} className="text-center">
                    {d ? (
                      <span className="inline-block rounded-full align-middle"
                        style={{ width: d, height: d, background: TONE, opacity: 0.8 }} title={`${r} ${c}: ${v}`} />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th />
            {cols.map((c) => <td key={c} className="pt-1 text-center text-[9px] text-muted-foreground">{c}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- S-curve */
/** Cumulative progress against plan — the shape most projects actually take. */
export function SCurve({
  actual, plan, height = 220, format = (n: number) => String(Math.round(n)) + "%", label,
}: {
  actual: number[]; plan: number[]; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!plan.length) return null;
  const n = plan.length;
  const hi = Math.max(...plan, ...actual) || 1;
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  const Y = (v: number) => 100 - (v / hi) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? "Cumulative progress against plan"}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={plan.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none"
            stroke={TONE} strokeOpacity={0.4} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          <polyline points={actual.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none"
            stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {format(actual[actual.length - 1])} done against {format(plan[actual.length - 1] ?? hi)} planned · dashed is plan
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- fan chart */
/**
 * A central projection with widening uncertainty bands.
 *
 * Bands rather than one line, because a single forecast line is read as a
 * promise. The widening is the message.
 */
export function FanChart({
  history, central, bands, height = 230, label,
}: {
  history: number[]; central: number[];
  /** Half-widths per step, innermost first. */
  bands: number[][]; height?: number; label?: string;
}) {
  if (!central.length) return null;
  const n = history.length + central.length;
  const widest = bands[bands.length - 1] ?? [];
  const hi = Math.max(...history, ...central.map((c, i) => c + (widest[i] ?? 0)));
  const lo = Math.min(...history, ...central.map((c, i) => c - (widest[i] ?? 0)));
  const span = hi - lo || 1;
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / span) * 96 - 2;
  const off = history.length - 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Projection with ${bands.length} uncertainty bands`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[...bands].reverse().map((band, bi) => (
            <polygon key={bi}
              points={[
                ...central.map((c, i) => `${X(off + i)},${Y(c + (band[i] ?? 0))}`),
                ...central.map((c, i) => `${X(off + i)},${Y(c - (band[i] ?? 0))}`).reverse(),
              ].join(" ")}
              fill={TONE} fillOpacity={0.07 + bi * 0.05} />
          ))}
          <polyline points={history.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          <polyline points={central.map((v, i) => `${X(off + i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <line x1={X(off)} x2={X(off)} y1={0} y2={100} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Solid is history · dashed is the central projection</p>
    </div>
  );
}

/* ------------------------------------------------------- month calendar */
/** A real month grid with a value per day. Reads as a calendar, not a chart. */
export function MonthCalendar({
  year, month, values, cell = 40, format = (n: number) => String(n), label,
}: {
  year: number; /** 0-indexed. */ month: number;
  values: Record<number, number>; cell?: number; format?: (n: number) => string; label?: string;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const hi = Math.max(...Object.values(values), 1);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="w-full" role="img"
      aria-label={label ?? `${first.toLocaleString("en", { month: "long", timeZone: "UTC" })} ${year}`}>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {names.map((n) => <div key={n} className="text-center text-[10px] text-muted-foreground">{n}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const v = values[d] ?? 0;
          const t = v / hi;
          return (
            <div key={d} className="flex flex-col items-center justify-center rounded-[3px] text-[10px]"
              style={{ height: cell, background: SHADE(t), color: inkOn(shadePct(t)) }}
              title={`${d}: ${format(v)}`}>
              <span className="opacity-70">{d}</span>
              {v ? <span className="text-[9px] tabular-nums">{format(v)}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- radial timeline */
/** Twenty-four hours as a clock face, radius by volume. */
export function RadialTimeline({
  hours, size = 260, label,
}: {
  hours: number[]; size?: number; label?: string;
}) {
  if (hours.length !== 24) return null;
  const hi = Math.max(...hours) || 1;
  const cx = size / 2, cy = size / 2;
  const rMin = size * 0.14, rMax = size * 0.44;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? "Bookings by hour of day"}>
      <circle cx={cx} cy={cy} r={rMin} fill="none" stroke="var(--border)" />
      <circle cx={cx} cy={cy} r={rMax} fill="none" stroke="var(--border)" />
      {hours.map((v, h) => {
        const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2;
        const r = rMin + (v / hi) * (rMax - rMin);
        const p = (a: number, rad: number) => `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`;
        return (
          <path key={h}
            d={`M ${p(a0, rMin)} L ${p(a0, r)} A ${r} ${r} 0 0 1 ${p(a1, r)} L ${p(a1, rMin)} A ${rMin} ${rMin} 0 0 0 ${p(a0, rMin)} Z`}
            fill={TONE} fillOpacity={0.25 + (v / hi) * 0.6} stroke="var(--background)" strokeWidth={0.6}>
            <title>{`${h}:00 — ${v}`}</title>
          </path>
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={h} x={cx + Math.cos(a) * (rMax + 12)} y={cy + Math.sin(a) * (rMax + 12)}
            textAnchor="middle" dominantBaseline="middle" fontSize={9} className="fill-muted-foreground">
            {h === 0 ? "12am" : h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`}
          </text>
        );
      })}
    </svg>
  );
}
