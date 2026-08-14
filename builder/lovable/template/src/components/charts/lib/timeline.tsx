/** Time-and-sequence charts with no recharts equivalent. */

const TONE = "var(--foreground)";
import { inkOn } from "./_ink";

const RAMP_PCT = (i: number, of = 4) => 12 + (i / of) * 78;
const RAMP = (i: number, of = 4) => `color-mix(in oklch, var(--foreground) ${RAMP_PCT(i, of)}%, var(--muted))`;

/* ----------------------------------------------------------------- horizon */
/**
 * A time series folded into bands so many series fit in very little height.
 *
 * Each band is the same slice of the value range, drawn darker — so a tall
 * spike becomes a dark patch rather than needing vertical room. Negative
 * values are mirrored and OUTLINED, because in one row of 24px colour alone
 * cannot carry the sign.
 */
export function Horizon({
  series, bands = 3, rowHeight = 28, label,
}: {
  series: { label: string; values: number[] }[];
  bands?: number; rowHeight?: number; label?: string;
}) {
  if (!series.length) return null;
  const peak = Math.max(...series.flatMap((s) => s.values.map(Math.abs))) || 1;
  const step = peak / bands;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${series.length} series folded into ${bands} bands`}>
      {series.map((s) => (
        <div key={s.label} className="mb-1 flex items-center gap-2">
          <span className="w-14 shrink-0 truncate text-right text-[10px] text-muted-foreground">{s.label}</span>
          <div className="relative flex-1 overflow-hidden rounded-[2px] bg-muted" style={{ height: rowHeight }}>
            {Array.from({ length: bands }, (_, b) => (
              <svg key={b} viewBox={`0 0 ${s.values.length - 1} ${step}`} preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full">
                <polygon
                  points={`0,${step} ${s.values.map((v, i) => {
                    const mag = Math.min(Math.max(Math.abs(v) - b * step, 0), step);
                    return `${i},${step - mag}`;
                  }).join(" ")} ${s.values.length - 1},${step}`}
                  fill={RAMP(b + 1, bands)} />
              </svg>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- cycle plot */
/**
 * A mini series per season — every Monday across the months, side by side.
 *
 * Answers the question a normal time series buries: is Monday getting better,
 * or does it only look that way because the whole shop is busier?
 */
export function CyclePlot({
  cycles, height = 200, format = (n: number) => String(n), label,
}: {
  cycles: { label: string; values: number[] }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!cycles.length) return null;
  const all = cycles.flatMap((c) => c.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;
  const slot = 100 / cycles.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${cycles.length} cycles`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {cycles.map((c, ci) => {
            const w = slot * 0.76;
            const x0 = ci * slot + (slot - w) / 2;
            const mean = c.values.reduce((s, v) => s + v, 0) / c.values.length;
            return (
              <g key={c.label}>
                <line x1={x0} x2={x0 + w} y1={100 - ((mean - lo) / span) * 100} y2={100 - ((mean - lo) / span) * 100}
                  stroke={TONE} strokeOpacity={0.35} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                <polyline
                  points={c.values.map((v, i) => `${x0 + (i / (c.values.length - 1 || 1)) * w},${100 - ((v - lo) / span) * 100}`).join(" ")}
                  fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex">
        {cycles.map((c) => (
          <div key={c.label} className="truncate text-center text-[10px] text-muted-foreground" style={{ width: `${slot}%` }}>
            {c.label}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Dashed line is each cycle's mean · {format(lo)}–{format(hi)}</p>
    </div>
  );
}

/* ------------------------------------------------------------ cohort grid */
/**
 * The retention triangle: one row per joining cohort, one column per period
 * since. Triangular by nature — a cohort that joined last month has no
 * month-six column yet, and leaving those cells EMPTY rather than zero is the
 * whole point. Zero would read as "everybody left".
 */
export function CohortGrid({
  cohorts, cell = 44, gap = 2, label,
}: {
  cohorts: { label: string; size: number; retained: number[] }[];
  cell?: number; gap?: number; label?: string;
}) {
  if (!cohorts.length) return null;
  const periods = Math.max(...cohorts.map((c) => c.retained.length));

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `Retention across ${cohorts.length} cohorts`}>
      <table className="border-separate" style={{ borderSpacing: gap }}>
        <thead>
          <tr>
            <th /><th className="text-[10px] font-normal text-muted-foreground">Size</th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} className="text-[10px] font-normal text-muted-foreground" style={{ width: cell }}>M{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.label}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{c.label}</th>
              <td className="pr-2 text-right text-[10px] tabular-nums text-muted-foreground">{c.size}</td>
              {Array.from({ length: periods }, (_, i) => {
                const v = c.retained[i];
                if (v === undefined) return <td key={i} />;
                const pct = v / (c.retained[0] || 1);
                return (
                  <td key={i}>
                    <div className="flex items-center justify-center rounded-[3px] text-[10px] tabular-nums"
                      style={{
                        width: cell, height: cell * 0.62,
                        background: RAMP(pct * 4, 4),
                        // Flips at 0.35, not 0.55. RAMP is already ~40% ink at
                        // that point, and muted-foreground on a mid grey is
                        // unreadable — measured: the 45% cells came out blank.
                        color: inkOn(RAMP_PCT(pct * 4, 4)),
                      }}
                      title={`${c.label} · M${i}: ${Math.round(pct * 100)}%`}>
                      {Math.round(pct * 100)}%
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

/* --------------------------------------------------------------- burndown */
/** Work remaining against the ideal straight line to zero. */
export function Burndown({
  actual, total, days, height = 220, up = false, format = (n: number) => String(n), label,
}: {
  actual: number[]; total: number; days?: string[]; height?: number;
  /** Burn UP — cumulative work done rather than remaining. */
  up?: boolean; format?: (n: number) => string; label?: string;
}) {
  if (!actual.length) return null;
  const n = actual.length;
  const hi = Math.max(total, ...actual) || 1;
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  const Y = (v: number) => 100 - (v / hi) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? (up ? "Work completed against plan" : "Work remaining against plan")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={up ? 100 : 0} x2={100} y2={up ? 0 : 100}
            stroke={TONE} strokeOpacity={0.35} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <polyline points={actual.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{days?.[0] ?? "Start"}</span>
        <span>{format(actual[actual.length - 1])} {up ? "done" : "left"} of {format(total)}</span>
        <span>{days?.[days.length - 1] ?? "End"}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- run chart */
/**
 * A measure over time against its median, with runs above/below marked.
 *
 * The median line is what makes it a run chart rather than a line chart: a run
 * of seven consecutive points on one side is the standard signal that
 * something actually changed, rather than noise.
 */
export function RunChart({
  values, labels, height = 200, format = (n: number) => String(n), label,
}: {
  values: number[]; labels?: string[]; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const X = (i: number) => (i / (values.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / span) * 100;

  let longest = 0, run = 0, side = 0;
  for (const v of values) {
    const s = Math.sign(v - median);
    if (s === 0) continue;
    run = s === side ? run + 1 : 1;
    side = s;
    longest = Math.max(longest, run);
  }

  return (
    <div className="w-full" role="img" aria-label={label ?? `${values.length} points around a median of ${format(median)}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={Y(median)} y2={Y(median)} stroke={TONE} strokeOpacity={0.45}
            strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <polyline points={values.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none"
            stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {values.map((v, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${X(i)}%`, top: `${Y(v)}%`, background: TONE }} title={`${labels?.[i] ?? i + 1}: ${format(v)}`} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Median {format(median)} · longest run {longest}{longest >= 7 ? " — a real shift, not noise" : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- event timeline */
/** Dated milestones on one axis. */
export function EventTimeline({
  events, height = 150, label,
}: {
  events: { at: number; label: string; note?: string; done?: boolean }[];
  height?: number; label?: string;
}) {
  if (!events.length) return null;
  const lo = Math.min(...events.map((e) => e.at)), hi = Math.max(...events.map((e) => e.at));
  const span = hi - lo || 1;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${events.length} milestones`}>
      <div className="absolute top-1/2 right-0 left-0 border-t border-border" />
      {events.map((e, i) => (
        <div key={`${e.label}-${i}`} className="absolute -translate-x-1/2" style={{ left: `${((e.at - lo) / span) * 100}%`, top: 0, height: "100%" }}>
          <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ background: e.done ? TONE : "var(--background)", borderColor: TONE }} />
          <div className={`absolute w-24 -translate-x-1/2 text-center text-[10px] leading-tight ${i % 2 ? "top-[56%]" : "bottom-[56%]"}`}>
            <span className="block font-medium">{e.label}</span>
            {e.note ? <span className="block text-muted-foreground">{e.note}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- swimlane */
/**
 * A process across stages, one lane per actor. `gantt`'s lanes are RESOURCES
 * over clock time; these are hand-offs — who does what, in what order.
 */
export function Swimlane({
  lanes, stages, laneHeight = 56, label,
}: {
  lanes: { label: string; steps: { stage: number; label: string }[] }[];
  stages: string[]; laneHeight?: number; label?: string;
}) {
  if (!lanes.length) return null;
  const w = 100 / stages.length;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${lanes.length} lanes across ${stages.length} stages`}>
      <div className="min-w-[420px]">
        <div className="flex pl-20">
          {stages.map((s) => (
            <div key={s} className="truncate px-1 pb-1 text-center text-[10px] font-medium" style={{ width: `${w}%` }}>{s}</div>
          ))}
        </div>
        {lanes.map((lane) => (
          <div key={lane.label} className="flex items-stretch border-t border-border">
            <div className="flex w-20 shrink-0 items-center pr-2 text-right text-[10px] text-muted-foreground">
              <span className="w-full truncate">{lane.label}</span>
            </div>
            <div className="relative flex-1" style={{ height: laneHeight }}>
              {stages.map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-border/50" style={{ left: `${i * w}%` }} />
              ))}
              {lane.steps.map((st, i) => (
                <div key={i} className="absolute top-1/2 -translate-y-1/2 truncate rounded-[3px] px-2 py-1 text-[10px]"
                  style={{ left: `${st.stage * w + w * 0.06}%`, width: `${w * 0.88}%`, background: TONE, color: "var(--background)" }}
                  title={st.label}>
                  {st.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- small multiples */
/** The same chart repeated per category — comparison by position, not colour. */
export function SmallMultiples({
  panels, columns = 4, panelHeight = 56, label,
}: {
  panels: { label: string; values: number[] }[];
  columns?: number; panelHeight?: number; label?: string;
}) {
  if (!panels.length) return null;
  // ONE scale across every panel. Per-panel scaling makes a quiet category
  // look identical to a busy one, which defeats the entire comparison.
  const all = panels.flatMap((p) => p.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="img" aria-label={label ?? `${panels.length} panels on one shared scale`}>
      {panels.map((p) => (
        <div key={p.label}>
          <div className="mb-1 truncate text-[10px] text-muted-foreground">{p.label}</div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height: panelHeight }}>
            <polygon points={`0,100 ${p.values.map((v, i) => `${(i / (p.values.length - 1 || 1)) * 100},${100 - ((v - lo) / span) * 100}`).join(" ")} 100,100`}
              fill={TONE} fillOpacity={0.14} />
            <polyline points={p.values.map((v, i) => `${(i / (p.values.length - 1 || 1)) * 100},${100 - ((v - lo) / span) * 100}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ spiral plot */
/** Cyclical time wound outwards — long series where the cycle is the point. */
export function SpiralPlot({
  values, perTurn = 12, size = 260, label,
}: {
  values: number[]; perTurn?: number; size?: number; label?: string;
}) {
  if (!values.length) return null;
  const hi = Math.max(...values) || 1;
  const turns = values.length / perTurn;
  const cx = size / 2, cy = size / 2;
  const rMin = size * 0.12, rMax = size * 0.46;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${values.length} points over ${turns.toFixed(1)} cycles`}>
      {values.map((v, i) => {
        const t = i / values.length;
        const a = (i / perTurn) * Math.PI * 2 - Math.PI / 2;
        const r = rMin + t * (rMax - rMin);
        const thick = 2 + (v / hi) * 9;
        const a2 = ((i + 1) / perTurn) * Math.PI * 2 - Math.PI / 2;
        const r2 = rMin + ((i + 1) / values.length) * (rMax - rMin);
        return (
          <line key={i}
            x1={cx + Math.cos(a) * r} y1={cy + Math.sin(a) * r}
            x2={cx + Math.cos(a2) * r2} y2={cy + Math.sin(a2) * r2}
            stroke={TONE} strokeOpacity={0.25 + (v / hi) * 0.7} strokeWidth={thick} strokeLinecap="round">
            <title>{String(v)}</title>
          </line>
        );
      })}
    </svg>
  );
}
