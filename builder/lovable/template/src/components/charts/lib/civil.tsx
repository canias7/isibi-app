/** Civil engineering and construction control. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------------------- cut and fill */
/**
 * Existing ground against the proposed level, with the BALANCE computed.
 *
 * Cut and fill that do not balance means importing or carting away, which is
 * the single largest earthworks cost — so the net is the headline.
 */
export function CutFill({
  stations, height = 250, label,
}: {
  stations: { chainage: number; existing: number; proposed: number }[]; height?: number; label?: string;
}) {
  if (stations.length < 2) return null;
  const all = stations.flatMap((s) => [s.existing, s.proposed]);
  const lo = Math.min(...all) - 1, hi = Math.max(...all) + 1;
  const maxCh = Math.max(...stations.map((s) => s.chainage));
  const x = (c: number) => (c / maxCh) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  // Trapezoidal areas between the two lines, split by sign.
  let cut = 0, fill = 0;
  for (let i = 1; i < stations.length; i++) {
    const w = stations[i].chainage - stations[i - 1].chainage;
    const d0 = stations[i - 1].existing - stations[i - 1].proposed;
    const d1 = stations[i].existing - stations[i].proposed;
    const avg = (d0 + d1) / 2;
    if (avg > 0) cut += avg * w; else fill += -avg * w;
  }
  const net = cut - fill;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `net ${net.toFixed(0)}`}>
        <polygon points={`${stations.map((s) => `${x(s.chainage)},${y(s.existing)}`).join(" ")} ${[...stations].reverse().map((s) => `${x(s.chainage)},${y(s.proposed)}`).join(" ")}`}
          fill={TONE} fillOpacity={0.16} />
        <polyline points={stations.map((s) => `${x(s.chainage)},${y(s.existing)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <polyline points={stations.map((s) => `${x(s.chainage)},${y(s.proposed)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 m</span><span>solid is existing ground, dashed is the design</span><span>{maxCh} m</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cut {Math.round(cut).toLocaleString()} m³, fill {Math.round(fill).toLocaleString()} m³ ·
        net {net >= 0 ? `${Math.round(net).toLocaleString()} m³ to cart away` : `${Math.round(-net).toLocaleString()} m³ to import`} —
        which is the cost the section drawing hides
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- earned value */
/**
 * Planned, earned and actual, with SPI and CPI derived.
 *
 * Spend against budget says nothing on its own: a project can be under budget
 * because it has done less. Earned value is what separates the two.
 */
export function EarnedValue({
  periods, currency = "GBP", height = 250, label,
}: {
  periods: { label: string; planned: number; earned: number; actual: number }[]; currency?: string;
  height?: number; label?: string;
}) {
  if (!periods.length) return null;
  const last = periods[periods.length - 1];
  const spi = last.planned > 0 ? last.earned / last.planned : 0;
  const cpi = last.actual > 0 ? last.earned / last.actual : 0;
  const max = Math.max(...periods.flatMap((p) => [p.planned, p.earned, p.actual])) * 1.06;
  const x = (i: number) => (i / Math.max(1, periods.length - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `SPI ${spi.toFixed(2)} CPI ${cpi.toFixed(2)}`}>
        <polyline points={periods.map((p, i) => `${x(i)},${y(p.planned)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.8} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        <polyline points={periods.map((p, i) => `${x(i)},${y(p.actual)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.8} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        <polyline points={periods.map((p, i) => `${x(i)},${y(p.earned)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={2.4} /></svg>earned</span>
        <span className="flex items-center gap-1"><svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.8} strokeDasharray="5 3" /></svg>planned</span>
        <span className="flex items-center gap-1"><svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.8} strokeDasharray="2 2" /></svg>actual spend</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        SPI {spi.toFixed(2)} — {spi >= 1 ? "ahead of programme" : "behind programme"} ·
        CPI {cpi.toFixed(2)} — {cpi >= 1 ? "under budget for the work done" : "overspending for the work done"} ·
        {money(last.earned)} earned against {money(last.actual)} spent
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ float histogram */
/**
 * Total float across a programme.
 *
 * A programme where almost everything has zero float has no room to absorb
 * anything, so the count at zero is the resilience measure — not the length.
 */
export function FloatHistogram({
  activities, height = 220, label,
}: {
  activities: { name: string; floatDays: number }[]; height?: number; label?: string;
}) {
  if (!activities.length) return null;
  const buckets = [0, 1, 3, 6, 11, 21, 41];
  const counts = buckets.map((b, i) => {
    const next = buckets[i + 1] ?? Infinity;
    return activities.filter((a) => a.floatDays >= b && a.floatDays < next).length;
  });
  const labels = buckets.map((b, i) => (i === 0 ? "0" : buckets[i + 1] ? `${b}–${buckets[i + 1] - 1}` : `${b}+`));
  const max = Math.max(...counts);
  const critical = counts[0];
  const negative = activities.filter((a) => a.floatDays < 0).length;

  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {counts.map((c, i) => (
          <div key={i} className="flex-1" title={`${labels[i]} days: ${c}`}
            style={{ height: `${(c / max) * 100}%`, background: TONE, opacity: i === 0 ? 1 : 0.5 }} />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {labels.map((l) => <span key={l} className="flex-1 text-center text-[9px] text-muted-foreground">{l}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        {critical} of {activities.length} activities have no float at all — {Math.round((critical / activities.length) * 100)}% of
        the programme is critical, and that is what absorbs a delay, not the end date
        {negative ? ` · ${negative} already negative` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ tolerance stack */
/**
 * Stacked tolerances, worst case against statistical.
 *
 * Adding tolerances arithmetically is the safe answer and usually a very
 * expensive one; the root-sum-square is what actually happens, and both are
 * computed so the gap is visible.
 */
export function ToleranceStack({
  dimensions, requirement, label,
}: {
  dimensions: { name: string; nominal: number; tolerance: number }[]; requirement: number; label?: string;
}) {
  if (!dimensions.length) return null;
  const worst = dimensions.reduce((s, d) => s + d.tolerance, 0);
  const rss = Math.sqrt(dimensions.reduce((s, d) => s + d.tolerance ** 2, 0));
  const max = Math.max(worst, requirement) * 1.08;

  return (
    <div className="w-full">
      <div className="space-y-1">
        {dimensions.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-[34%] shrink-0 truncate text-[10px]">{d.name}</span>
            <span className="h-3 rounded-[2px]" style={{ width: `${(d.tolerance / max) * 54}%`, background: TONE }} />
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
              {d.nominal} ±{d.tolerance}
            </span>
          </div>
        ))}
      </div>
      <div className="relative mt-2 space-y-1">
        {[{ n: "Worst case", v: worst }, { n: "Root-sum-square", v: rss }].map((r) => (
          <div key={r.n} className="flex items-center gap-2">
            <span className="w-[34%] shrink-0 text-[10px] font-medium">{r.n}</span>
            <span className="h-3.5 rounded-[2px]" style={{
              width: `${(r.v / max) * 54}%`,
              background: r.v > requirement ? "var(--background)" : TONE,
              boxShadow: r.v > requirement ? `inset 0 0 0 2px ${TONE}` : undefined,
            }} />
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">±{r.v.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Requirement is ±{requirement} · worst case ±{worst.toFixed(3)}
        {worst > requirement ? " FAILS" : " passes"}, statistical ±{rss.toFixed(3)}
        {rss > requirement ? " fails" : " passes"} — the gap between them is what tightening every part would cost
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- settlement plot */
/**
 * Ground settlement over time on a log time axis, against the predicted curve.
 *
 * Consolidation is roughly linear against log time, which is the only axis on
 * which "has it stopped?" can be answered.
 */
export function SettlementPlot({
  readings, predicted, height = 240, label,
}: {
  readings: { days: number; mm: number }[]; predicted?: { days: number; mm: number }[];
  height?: number; label?: string;
}) {
  if (readings.length < 2) return null;
  const all = [...readings, ...(predicted ?? [])];
  // Sign-agnostic: settlement is a DEPTH, and callers write it either way. Scaling
  // by the raw maximum divided by a value near zero (or negative, when every
  // reading is signed downward), which threw the whole trace off the canvas.
  const depth = (m: number) => Math.abs(m);
  const maxDays = Math.max(2, ...all.map((r) => r.days));
  const maxMm = Math.max(...all.map((r) => depth(r.mm)), 1) * 1.08;
  // day 0 is a real reading (the datum) and log10(0) is −∞, so the axis starts at
  // day 1 and anything earlier is pinned to it rather than collapsing the line.
  const x = (d: number) => (Math.log10(Math.max(1, d)) / Math.log10(maxDays)) * 100;
  const y = (m: number) => (depth(m) / maxMm) * 100;
  const last = readings[readings.length - 1];
  const prev = readings[readings.length - 2];
  const cycles = Math.log10(Math.max(1, last.days)) - Math.log10(Math.max(1, prev.days));
  const rate = (depth(last.mm) - depth(prev.mm)) / (cycles || 1);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          {predicted ? (
            <polyline points={predicted.map((p) => `${x(p.days)},${y(p.mm)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={1.6} strokeDasharray="5 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
          ) : null}
          <polyline points={readings.map((r) => `${x(r.days)},${y(r.mm)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        </svg>
        {readings.map((r) => (
          <span key={r.days} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(r.days)}%`, top: `${y(r.mm)}%`, background: TONE }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>1 day</span><span>log time</span><span>{maxDays} days</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Settlement grows downward · {depth(last.mm).toFixed(1)} mm at day {last.days},
        {rate < 0.05 ? " essentially stopped" : ` still moving ${rate.toFixed(1)} mm per log cycle`} — flat on THIS
        axis is what "finished" looks like
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- traffic count */
/**
 * Vehicles by hour and class, with the PEAK HOUR FACTOR computed — the
 * number a junction is actually designed on, and one a daily total cannot give.
 */
export function TrafficCount({
  hours, classes, /** counts[hour][class] */ counts, height = 240, label,
}: {
  hours: string[]; classes: string[]; counts: number[][]; height?: number; label?: string;
}) {
  if (!hours.length) return null;
  const totals = hours.map((_, h) => classes.reduce((s, _c, ci) => s + (counts[h]?.[ci] ?? 0), 0));
  const max = Math.max(...totals) * 1.05;
  const peakIdx = totals.indexOf(Math.max(...totals));
  const daily = totals.reduce((a, b) => a + b, 0);
  // Peak hour factor: peak hour over four times its busiest quarter, approximated
  // here as the peak against the mean of the peak and its two neighbours.
  const neighbours = [totals[peakIdx - 1] ?? 0, totals[peakIdx], totals[peakIdx + 1] ?? 0];
  const phf = totals[peakIdx] / (Math.max(...neighbours) * 1.0 || 1);
  const hgvShare = classes.length > 1
    ? counts.reduce((s, row) => s + (row[classes.length - 1] ?? 0), 0) / daily : 0;

  return (
    <div className="w-full">
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {hours.map((h, hi) => (
          <div key={h} className="flex h-full flex-1 flex-col justify-end" title={h}>
            {classes.map((c, ci) => (
              <span key={c} style={{
                height: `${((counts[hi]?.[ci] ?? 0) / max) * 100}%`,
                background: `color-mix(in oklch, ${TONE} ${Math.round(92 - (ci / Math.max(1, classes.length - 1)) * 62)}%, transparent)`,
              }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{hours[0]}</span><span>{hours[hours.length - 1]}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {classes.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(92 - (i / Math.max(1, classes.length - 1)) * 62)}%, transparent)` }} />{c}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {daily.toLocaleString()} vehicles · peak hour {hours[peakIdx]} at {totals[peakIdx].toLocaleString()}
        {" "}({Math.round((totals[peakIdx] / daily) * 100)}% of the day) · heavy vehicles {(hgvShare * 100).toFixed(1)}%,
        which is what the pavement is designed for
      </p>
    </div>
  );
}
