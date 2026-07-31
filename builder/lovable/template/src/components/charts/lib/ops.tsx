/** Time-series monitoring, business and operations charts. */

const TONE = "var(--foreground)";

/* ----------------------------------------------------------- anomaly band */
/**
 * A series with an expected band, and points outside it flagged.
 *
 * Flagged points get a RING as well as sitting outside the band: on a printed
 * or greyscale copy the band edge alone is easy to miss.
 */
export function AnomalyBand({
  values, expected, tolerance, height = 220, label,
}: {
  values: number[]; expected: number[]; /** Half-width per step. */ tolerance: number[];
  height?: number; label?: string;
}) {
  if (!values.length) return null;
  const n = values.length;
  const hi = Math.max(...values, ...expected.map((e, i) => e + (tolerance[i] ?? 0)));
  const lo = Math.min(...values, ...expected.map((e, i) => e - (tolerance[i] ?? 0)));
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 96 - 2;
  const odd = values.map((v, i) => Math.abs(v - expected[i]) > (tolerance[i] ?? 0));

  return (
    <div className="w-full" role="img" aria-label={label ?? `${odd.filter(Boolean).length} points outside the expected band`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={[
              ...expected.map((e, i) => `${X(i)},${Y(e + (tolerance[i] ?? 0))}`),
              ...expected.map((e, i) => `${X(i)},${Y(e - (tolerance[i] ?? 0))}`).reverse(),
            ].join(" ")}
            fill={TONE} fillOpacity={0.1} />
          <polyline points={values.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {values.map((v, i) => odd[i] ? (
          <span key={i} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: `${X(i)}%`, top: `${Y(v)}%`, borderColor: TONE, background: "var(--background)" }}
            title={`Outside expected: ${v}`} />
        ) : null)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {odd.filter(Boolean).length} ringed points fell outside the expected band
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- change point */
/** A series split at a detected step, with each side's mean drawn. */
export function ChangePoint({
  values, at, height = 220, format = (n: number) => n.toFixed(1), label,
}: {
  values: number[]; at: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!values.length) return null;
  const before = values.slice(0, at), after = values.slice(at);
  const mA = before.reduce((s, v) => s + v, 0) / (before.length || 1);
  const mB = after.reduce((s, v) => s + v, 0) / (after.length || 1);
  const lo = Math.min(...values), hi = Math.max(...values);
  const X = (i: number) => (i / (values.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 92 - 4;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Level shifted from ${format(mA)} to ${format(mB)}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={X(0)} x2={X(at - 1)} y1={Y(mA)} y2={Y(mA)} stroke={TONE} strokeOpacity={0.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <line x1={X(at)} x2={X(values.length - 1)} y1={Y(mB)} y2={Y(mB)} stroke={TONE} strokeOpacity={0.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <polyline points={values.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${X(at)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Level moved from {format(mA)} to {format(mB)}</p>
    </div>
  );
}

/* --------------------------------------------------------- seasonal polar */
/** Months on a circle, one ring per year. */
export function SeasonalPolar({
  years, size = 270, label,
}: {
  years: { label: string; values: number[] }[]; size?: number; label?: string;
}) {
  if (!years.length) return null;
  const all = years.flatMap((y) => y.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const cx = size / 2, cy = size / 2;
  const rMin = size * 0.12, rMax = size * 0.4;
  const R = (v: number) => rMin + ((v - lo) / (hi - lo || 1)) * (rMax - rMin);
  const names = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${years.length} years by month`}>
        {[0.33, 0.66, 1].map((t) => <circle key={t} cx={cx} cy={cy} r={rMin + (rMax - rMin) * t} fill="none" stroke="var(--border)" strokeOpacity={0.6} />)}
        {names.map((m, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          return (
            <text key={`${m}-${i}`} x={cx + Math.cos(a) * (rMax + 13)} y={cy + Math.sin(a) * (rMax + 13)}
              textAnchor="middle" dominantBaseline="middle" fontSize={9} className="fill-muted-foreground">{m}</text>
          );
        })}
        {years.map((y, yi) => {
          const pts = y.values.map((v, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            return `${cx + Math.cos(a) * R(v)},${cy + Math.sin(a) * R(v)}`;
          });
          const latest = yi === years.length - 1;
          return (
            <polygon key={y.label} points={pts.join(" ")} fill="none" stroke={TONE}
              strokeWidth={latest ? 2 : 1} strokeOpacity={latest ? 1 : 0.35}
              strokeDasharray={latest ? undefined : "4 3"} />
          );
        })}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
        {years.map((y, i) => <span key={y.label}>{i === years.length - 1 ? "▬ " : "-- "}{y.label}</span>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ raster plot */
/** One row per unit, one mark per event. Dense event timing at a glance. */
export function RasterPlot({
  rows, span, rowHeight = 14, label,
}: {
  rows: { label: string; events: number[] }[]; span: [number, number];
  rowHeight?: number; label?: string;
}) {
  if (!rows.length) return null;
  const [lo, hi] = span;
  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} rows of events`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2" style={{ height: rowHeight }}>
          <span className="w-14 shrink-0 truncate text-right text-[9px] text-muted-foreground">{r.label}</span>
          <div className="relative h-full flex-1 border-b border-border/40">
            {r.events.map((e, i) => (
              <span key={i} className="absolute top-1 bottom-1 w-px" style={{ left: `${((e - lo) / (hi - lo || 1)) * 100}%`, background: TONE }} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-1 flex justify-between pl-16 text-[10px] tabular-nums text-muted-foreground">
        <span>{lo}</span><span>{hi}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- runway chart */
/** Cash against burn, with the month it runs out. */
export function RunwayChart({
  balance, height = 220, format = (n: number) => "£" + Math.round(n).toLocaleString(), labels, label,
}: {
  balance: number[]; height?: number; format?: (n: number) => string; labels?: string[]; label?: string;
}) {
  if (!balance.length) return null;
  const zeroAt = balance.findIndex((v) => v <= 0);
  const hi = Math.max(...balance, 0);
  const lo = Math.min(...balance, 0);
  const X = (i: number) => (i / (balance.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? (zeroAt >= 0 ? `Runs out at period ${zeroAt}` : "Does not run out in this window")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,${Y(0)} ${balance.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} 100,${Y(0)}`} fill={TONE} fillOpacity={0.12} />
          <polyline points={balance.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={Y(0)} y2={Y(0)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
        {zeroAt >= 0 ? <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${X(zeroAt)}%` }} /> : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {format(balance[0])} today · {zeroAt >= 0 ? `runs out at ${labels?.[zeroAt] ?? `period ${zeroAt}`}` : "still positive at the end of the window"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------- queue and waits */
/** Arrivals against served, with the wait implied by the gap. */
export function QueueWait({
  periods, arrivals, served, waits, height = 210, label,
}: {
  periods: string[]; arrivals: number[]; served: number[]; waits?: number[];
  height?: number; label?: string;
}) {
  if (!periods.length) return null;
  const hi = Math.max(...arrivals, ...served) || 1;
  const slot = 100 / periods.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? "Arrivals against capacity"}>
      <div className="relative" style={{ height }}>
        {periods.map((p, i) => (
          <div key={p}>
            <div className="absolute rounded-t-[2px]"
              style={{ left: `${i * slot + slot * 0.12}%`, width: `${slot * 0.34}%`, bottom: 0, height: `${(arrivals[i] / hi) * 100}%`, background: TONE, opacity: 0.85 }}
              title={`${p}: ${arrivals[i]} arrived`} />
            <div className="absolute rounded-t-[2px] border"
              style={{ left: `${i * slot + slot * 0.5}%`, width: `${slot * 0.34}%`, bottom: 0, height: `${(served[i] / hi) * 100}%`, background: "transparent", borderColor: TONE }}
              title={`${p}: ${served[i]} served`} />
          </div>
        ))}
        {waits ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <polyline points={waits.map((w, i) => `${i * slot + slot / 2},${100 - (w / Math.max(...waits)) * 60}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
      </div>
      <div className="flex">
        {periods.map((p) => <div key={p} className="text-center text-[10px] text-muted-foreground" style={{ width: `${slot}%` }}>{p}</div>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Solid arrived · outlined served{waits ? " · dashed is average wait" : ""}</p>
    </div>
  );
}

/* ------------------------------------------------------- capacity vs demand */
/** Demand as bars against a capacity line, with the shortfall shaded. */
export function CapacityDemand({
  periods, demand, capacity, height = 220, label,
}: {
  periods: string[]; demand: number[]; capacity: number[]; height?: number; label?: string;
}) {
  if (!periods.length) return null;
  const hi = Math.max(...demand, ...capacity) || 1;
  const slot = 100 / periods.length;
  const short = demand.map((d, i) => Math.max(0, d - capacity[i]));

  return (
    <div className="w-full" role="img" aria-label={label ?? `${short.filter((s) => s > 0).length} periods over capacity`}>
      <div className="relative" style={{ height }}>
        {demand.map((d, i) => (
          <div key={i}>
            <div className="absolute rounded-t-[2px]"
              style={{ left: `${i * slot + slot * 0.2}%`, width: `${slot * 0.6}%`, bottom: 0, height: `${(Math.min(d, capacity[i]) / hi) * 100}%`, background: TONE, opacity: 0.6 }} />
            {short[i] > 0 ? (
              <div className="absolute rounded-t-[2px] border-2"
                style={{ left: `${i * slot + slot * 0.2}%`, width: `${slot * 0.6}%`, bottom: `${(capacity[i] / hi) * 100}%`, height: `${(short[i] / hi) * 100}%`, borderColor: TONE, background: "var(--background)" }}
                title={`${periods[i]}: ${short[i]} over capacity`} />
            ) : null}
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={capacity.map((c, i) => `${i * slot + slot / 2},${100 - (c / hi) * 100}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.6} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex">
        {periods.map((p) => <div key={p} className="text-center text-[10px] text-muted-foreground" style={{ width: `${slot}%` }}>{p}</div>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Outlined blocks are demand we could not serve</p>
    </div>
  );
}

/* ------------------------------------------------------------- LTV curve */
/** Cumulative revenue per customer over their lifetime, by cohort. */
export function LtvCurve({
  cohorts, height = 220, format = (n: number) => "£" + Math.round(n), label,
}: {
  cohorts: { label: string; values: number[] }[]; height?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!cohorts.length) return null;
  const all = cohorts.flatMap((c) => c.values);
  const hi = Math.max(...all) || 1;
  const n = Math.max(...cohorts.map((c) => c.values.length));
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  const Y = (v: number) => 100 - (v / hi) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Lifetime value across ${cohorts.length} cohorts`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {cohorts.map((c, i) => (
            <polyline key={c.label} points={c.values.map((v, k) => `${X(k)},${Y(v)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={i === 0 ? 2 : 1.1} strokeOpacity={i === 0 ? 1 : 0.4}
              strokeDasharray={i === 0 ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
        {cohorts.map((c) => <span key={c.label}>{c.label} → {format(c.values[c.values.length - 1])}</span>)}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- payback period */
/** Cumulative profit crossing zero — when the acquisition cost is repaid. */
export function PaybackPeriod({
  cumulative, height = 220, format = (n: number) => "£" + Math.round(n), labels, label,
}: {
  cumulative: number[]; height?: number; format?: (n: number) => string; labels?: string[]; label?: string;
}) {
  if (!cumulative.length) return null;
  const crossAt = cumulative.findIndex((v) => v >= 0);
  const hi = Math.max(...cumulative), lo = Math.min(...cumulative);
  const X = (i: number) => (i / (cumulative.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? (crossAt >= 0 ? `Paid back at period ${crossAt}` : "Not yet paid back")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={cumulative.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={Y(0)} y2={Y(0)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
        {crossAt >= 0 ? <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${X(crossAt)}%` }} /> : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {crossAt >= 0 ? `Repaid at ${labels?.[crossAt] ?? `month ${crossAt}`} · ${format(cumulative[cumulative.length - 1])} by the end` : "Not repaid within the window"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------- NPS distribution */
/**
 * The 0–10 spread with the three NPS groups marked, and the score.
 *
 * The distribution is shown as well as the headline number because two very
 * different shapes give the same NPS, and only one of them is a business with
 * a problem worth chasing.
 */
export function NpsDistribution({
  counts, height = 190, label,
}: {
  /** counts[0..10] */ counts: number[]; height?: number; label?: string;
}) {
  if (counts.length !== 11) return null;
  const total = counts.reduce((s, v) => s + v, 0) || 1;
  const det = counts.slice(0, 7).reduce((s, v) => s + v, 0);
  const pro = counts.slice(9).reduce((s, v) => s + v, 0);
  const nps = Math.round(((pro - det) / total) * 100);
  const peak = Math.max(...counts) || 1;
  const band = (i: number) => (i <= 6 ? 0.25 : i <= 8 ? 0.5 : 0.9);

  return (
    <div className="w-full" role="img" aria-label={label ?? `NPS ${nps}`}>
      <div className="flex w-full items-end gap-[3px]" style={{ height }}>
        {counts.map((c, i) => (
          <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${(c / peak) * 100}%`, background: TONE, opacity: band(i) }}
            title={`${i}: ${c}`} />
        ))}
      </div>
      <div className="mt-1 flex w-full gap-[3px]">
        {counts.map((_, i) => <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground">{i}</div>)}
      </div>
      <p className="mt-2 text-[11px]">
        <span className="font-medium">NPS {nps}</span>
        <span className="text-muted-foreground"> · {Math.round((pro / total) * 100)}% promoters, {Math.round((det / total) * 100)}% detractors</span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- margin bridge */
/** How margin moved between two periods, decomposed by driver. */
export function MarginBridge({
  from, to, drivers, height = 220, format = (n: number) => n.toFixed(1) + "%", label,
}: {
  from: number; to: number; drivers: { label: string; value: number }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  const steps = [{ label: "Start", value: from, total: true }, ...drivers.map((d) => ({ ...d, total: false })), { label: "End", value: to, total: true }];
  let run = 0;
  const bars = steps.map((s) => {
    const a = s.total ? 0 : run;
    const b = s.total ? s.value : run + s.value;
    run = b;
    return { ...s, from: a, to: b, rise: b >= a };
  });
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
  const hi = Math.max(...bars.map((b) => Math.max(b.from, b.to))) || 1;
  const Y = (v: number) => ((hi - v) / (hi - lo || 1)) * 100;
  const colW = 100 / bars.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Margin from ${format(from)} to ${format(to)}`}>
      <div className="relative" style={{ height }}>
        {bars.map((b, i) => {
          const top = Math.min(Y(b.from), Y(b.to));
          const h = Math.abs(Y(b.to) - Y(b.from));
          return (
            <div key={`${b.label}-${i}`}>
              <div className="absolute rounded-[2px]"
                style={{
                  top: `${top}%`, height: `max(2px, ${h}%)`,
                  left: `${i * colW + colW * 0.18}%`, width: `${colW * 0.64}%`,
                  background: b.total ? TONE : b.rise ? "color-mix(in oklch, var(--foreground) 60%, transparent)" : "transparent",
                  border: !b.total && !b.rise ? `1px solid ${TONE}` : undefined,
                }} title={`${b.label}: ${b.total ? format(b.to) : (b.rise ? "+" : "−") + format(Math.abs(b.value))}`} />
              <span className="absolute text-center text-[9px] tabular-nums text-muted-foreground"
                style={{ top: `calc(${top}% - 13px)`, left: `${i * colW}%`, width: `${colW}%` }}>
                {b.total ? format(b.to) : `${b.rise ? "↑" : "↓"}${Math.abs(b.value).toFixed(1)}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex">
        {bars.map((b, i) => (
          <div key={`${b.label}-l-${i}`} className="truncate px-0.5 text-center text-[9px] text-muted-foreground" style={{ width: `${colW}%` }}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- price-volume-mix */
/** Revenue change split into the three things that can cause it. */
export function PriceVolumeMix({
  from, to, price, volume, mix, height = 210, format = (n: number) => "£" + Math.round(n).toLocaleString(), label,
}: {
  from: number; to: number; price: number; volume: number; mix: number;
  height?: number; format?: (n: number) => string; label?: string;
}) {
  const parts = [
    { label: "Last year", value: from, total: true },
    { label: "Price", value: price },
    { label: "Volume", value: volume },
    { label: "Mix", value: mix },
    { label: "This year", value: to, total: true },
  ];
  let run = 0;
  const bars = parts.map((p) => {
    const a = p.total ? 0 : run;
    const b = p.total ? p.value : run + p.value;
    run = b;
    return { ...p, from: a, to: b, rise: b >= a };
  });
  const hi = Math.max(...bars.map((b) => Math.max(b.from, b.to))) || 1;
  const Y = (v: number) => ((hi - v) / hi) * 100;
  const colW = 100 / bars.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Revenue from ${format(from)} to ${format(to)}`}>
      <div className="relative" style={{ height }}>
        {bars.map((b, i) => {
          const top = Math.min(Y(b.from), Y(b.to));
          const h = Math.abs(Y(b.to) - Y(b.from));
          return (
            <div key={b.label} className="absolute rounded-[2px]"
              style={{
                top: `${top}%`, height: `max(2px, ${h}%)`,
                left: `${i * colW + colW * 0.2}%`, width: `${colW * 0.6}%`,
                background: b.total ? TONE : b.rise ? "color-mix(in oklch, var(--foreground) 58%, transparent)" : "transparent",
                border: !b.total && !b.rise ? `1px solid ${TONE}` : undefined,
              }} title={`${b.label}: ${format(b.total ? b.to : b.value)}`} />
          );
        })}
      </div>
      <div className="flex">
        {bars.map((b) => <div key={b.label} className="truncate text-center text-[9px] text-muted-foreground" style={{ width: `${colW}%` }}>{b.label}</div>)}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- discount ladder */
/** What each discount band costs and what it brings in. */
export function DiscountLadder({
  bands, height = 210, format = (n: number) => "£" + n.toLocaleString(), label,
}: {
  bands: { label: string; orders: number; revenue: number; cost: number }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!bands.length) return null;
  const hi = Math.max(...bands.map((b) => b.revenue)) || 1;
  const slot = 100 / bands.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${bands.length} discount bands`}>
      <div className="relative" style={{ height }}>
        {bands.map((b, i) => (
          <div key={b.label}>
            <div className="absolute rounded-t-[2px]"
              style={{ left: `${i * slot + slot * 0.2}%`, width: `${slot * 0.6}%`, bottom: 0, height: `${(b.revenue / hi) * 100}%`, background: TONE, opacity: 0.75 }}
              title={`${b.label}: ${format(b.revenue)} from ${b.orders} orders`} />
            <div className="absolute rounded-t-[2px] border-2"
              style={{ left: `${i * slot + slot * 0.2}%`, width: `${slot * 0.6}%`, bottom: 0, height: `${(b.cost / hi) * 100}%`, borderColor: TONE, background: "transparent" }}
              title={`${b.label}: ${format(b.cost)} given away`} />
          </div>
        ))}
      </div>
      <div className="flex">
        {bands.map((b) => (
          <div key={b.label} className="text-center" style={{ width: `${slot}%` }}>
            <div className="text-[10px]">{b.label}</div>
            <div className="text-[9px] text-muted-foreground">{b.orders} orders</div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Filled is revenue · outlined is the discount given away</p>
    </div>
  );
}

/* ------------------------------------------------------------ attach rate */
/** What share of a base service is sold with each add-on. */
export function AttachRate({
  base, addons, format = (n: number) => Math.round(n * 100) + "%", label,
}: {
  base: { label: string; count: number };
  addons: { label: string; count: number }[]; format?: (n: number) => string; label?: string;
}) {
  if (!addons.length) return null;
  const rows = [...addons].sort((a, b) => b.count - a.count);
  return (
    <div className="w-full" role="img" aria-label={label ?? `Add-ons attached to ${base.count} ${base.label}`}>
      <p className="mb-2 text-[11px] text-muted-foreground">{base.count.toLocaleString()} {base.label}</p>
      <div className="space-y-1.5">
        {rows.map((a) => {
          const rate = a.count / (base.count || 1);
          return (
            <div key={a.label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-right text-[10px] text-muted-foreground">{a.label}</span>
              <div className="h-4 flex-1 rounded-[2px] bg-muted">
                <div className="h-full rounded-[2px]" style={{ width: `${Math.min(100, rate * 100)}%`, background: TONE }} />
              </div>
              <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {format(rate)} · {a.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- churn reasons */
/** Why people left, ranked, with the share of the total. */
export function ChurnReasons({
  reasons, label,
}: {
  reasons: { label: string; count: number; recoverable?: boolean }[]; label?: string;
}) {
  const rows = [...reasons].sort((a, b) => b.count - a.count);
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <div className="w-full space-y-1.5" role="img" aria-label={label ?? `${total} departures across ${rows.length} reasons`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-right text-[10px] text-muted-foreground">{r.label}</span>
          <div className="h-4 flex-1 rounded-[2px] bg-muted">
            {/* Recoverable reasons are solid, the rest outlined — the split
                that decides whether the number is worth acting on. */}
            <div className="h-full rounded-[2px]"
              style={{
                width: `${(r.count / total) * 100}%`,
                background: r.recoverable === false ? "transparent" : TONE,
                border: r.recoverable === false ? `1px solid ${TONE}` : undefined,
              }} />
          </div>
          <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {Math.round((r.count / total) * 100)}%
          </span>
        </div>
      ))}
      <p className="pt-1 text-[10px] text-muted-foreground">Solid is something we could have changed</p>
    </div>
  );
}

/* ---------------------------------------------------------------- windrose */
/** Frequency by direction, stacked by band. */
export function WindRose({
  directions, bands, values, size = 280, label,
}: {
  directions: string[]; bands: string[]; /** values[dir][band] */ values: number[][];
  size?: number; label?: string;
}) {
  if (!directions.length) return null;
  const totals = values.map((d) => d.reduce((s, v) => s + v, 0));
  const hi = Math.max(...totals) || 1;
  const cx = size / 2, cy = size / 2;
  const rMax = size * 0.38;
  const step = (Math.PI * 2) / directions.length;
  const tone = (i: number) => `color-mix(in oklch, var(--foreground) ${Math.round(88 - (i / Math.max(1, bands.length - 1)) * 70)}%, transparent)`;
  const pt = (a: number, r: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `Frequency across ${directions.length} directions`}>
        {[0.33, 0.66, 1].map((t) => <circle key={t} cx={cx} cy={cy} r={rMax * t} fill="none" stroke="var(--border)" strokeOpacity={0.6} />)}
        {directions.map((d, di) => {
          const a0 = di * step - Math.PI / 2 - step * 0.42;
          const a1 = di * step - Math.PI / 2 + step * 0.42;
          let acc = 0;
          return values[di].map((v, bi) => {
            const rIn = (acc / hi) * rMax;
            acc += v;
            const rOut = (acc / hi) * rMax;
            return (
              <path key={`${d}-${bi}`}
                d={`M ${pt(a0, rIn)} L ${pt(a0, rOut)} A ${rOut} ${rOut} 0 0 1 ${pt(a1, rOut)} L ${pt(a1, rIn)} A ${rIn} ${rIn} 0 0 0 ${pt(a0, rIn)} Z`}
                fill={tone(bi)} stroke="var(--background)" strokeWidth={0.5}>
                <title>{`${d} · ${bands[bi]}: ${v}`}</title>
              </path>
            );
          });
        })}
        {directions.map((d, di) => {
          const a = di * step - Math.PI / 2;
          return (
            <text key={d} x={cx + Math.cos(a) * (rMax + 14)} y={cy + Math.sin(a) * (rMax + 14)}
              textAnchor="middle" dominantBaseline="middle" fontSize={9} className="fill-muted-foreground">{d}</text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {bands.map((b, i) => (
          <span key={b} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: tone(i) }} />{b}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ critical path */
/**
 * Tasks with dependencies, the longest chain drawn heavier.
 *
 * The critical path is COMPUTED here — the longest route to each task by
 * forward pass. A caller marking it by hand gets it wrong the moment a
 * duration changes, which is exactly when it matters.
 */
export function CriticalPath({
  tasks, rowHeight = 32, labelWidth = 92, label,
}: {
  tasks: { id: string; name: string; duration: number; after?: string[] }[];
  rowHeight?: number; labelWidth?: number; label?: string;
}) {
  if (!tasks.length) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const start = new Map<string, number>();
  const early = (id: string): number => {
    if (start.has(id)) return start.get(id)!;
    const t = byId.get(id)!;
    const s = Math.max(0, ...(t.after ?? []).map((d) => early(d) + (byId.get(d)?.duration ?? 0)));
    start.set(id, s);
    return s;
  };
  tasks.forEach((t) => early(t.id));
  const finish = (id: string) => start.get(id)! + (byId.get(id)?.duration ?? 0);
  const total = Math.max(...tasks.map((t) => finish(t.id))) || 1;

  // Walk back from whichever task finishes last.
  const critical = new Set<string>();
  let cur = tasks.reduce((a, b) => (finish(a.id) >= finish(b.id) ? a : b));
  for (;;) {
    critical.add(cur.id);
    const prev = (cur.after ?? []).map((d) => byId.get(d)!).filter(Boolean)
      .sort((a, b) => finish(b.id) - finish(a.id))[0];
    if (!prev || finish(prev.id) !== start.get(cur.id)) break;
    cur = prev;
  }

  return (
    <div className="w-full" role="img" aria-label={label ?? `Critical path is ${total} days`}>
      <div className="flex">
        <div style={{ width: labelWidth }} className="shrink-0">
          {tasks.map((t) => (
            <div key={t.id} style={{ height: rowHeight }} className="flex items-center pr-2 text-[10px] text-muted-foreground">
              <span className="truncate">{t.name}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: tasks.length * rowHeight }}>
          {tasks.map((t, i) => {
            const on = critical.has(t.id);
            return (
              <div key={t.id} className="absolute rounded-[3px]"
                style={{
                  left: `${(start.get(t.id)! / total) * 100}%`,
                  width: `${Math.max(1, (t.duration / total) * 100)}%`,
                  top: i * rowHeight + 7, height: rowHeight - 16,
                  background: on ? TONE : "transparent",
                  border: on ? undefined : `1px solid ${TONE}`,
                }}
                title={`${t.name}: day ${start.get(t.id)}–${finish(t.id)}${on ? " (critical)" : ""}`} />
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid bars are the critical path · {total} days end to end
      </p>
    </div>
  );
}
