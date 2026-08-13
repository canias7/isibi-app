/** Electricity: how a grid is dispatched, priced and kept in step. */

const TONE = "var(--foreground)";

/* --------------------------------------------------- load duration curve */
/**
 * Every hour of the year, sorted by demand rather than by time.
 *
 * Sorting is the whole point: it turns "when" into "how often", so the flat
 * left shoulder is the peak plant that runs a handful of hours a year and
 * still has to be paid for.
 */
export function LoadDurationCurve({
  hourlyLoad, baseloadCapacity, height = 240, label,
}: {
  hourlyLoad: number[]; baseloadCapacity?: number; height?: number; label?: string;
}) {
  if (hourlyLoad.length < 2) return null;
  const sorted = [...hourlyLoad].sort((a, b) => b - a);
  const max = sorted[0], n = sorted.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / (max * 1.05)) * 100;
  const peak = sorted[0];
  // Hours above 90% of peak — the number that decides how much peaking plant
  // has to exist for how little running.
  const topHours = sorted.filter((v) => v >= peak * 0.9).length;
  const aboveBase = baseloadCapacity ? sorted.filter((v) => v > baseloadCapacity).length : 0;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `peak ${peak}, above 90% for ${topHours} hours`}>
        <polygon points={`0,100 ${sorted.map((v, i) => `${x(i)},${y(v)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.14} />
        <polyline points={sorted.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {baseloadCapacity ? (
          <line x1={0} y1={y(baseloadCapacity)} x2={100} y2={y(baseloadCapacity)}
            stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>hour 1</span><span>sorted by demand, not by time</span><span>hour {n.toLocaleString()}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Peak {peak.toLocaleString()} MW, reached within 10% for only {topHours} of {n.toLocaleString()} hours
        {baseloadCapacity ? ` · demand exceeds the ${baseloadCapacity.toLocaleString()} MW baseload for ${aboveBase} hours` : ""}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- merit order */
/**
 * Generators stacked cheapest first against demand.
 *
 * The CLEARING PRICE is the marginal plant's cost — the last one needed — and
 * everybody is paid it, which is why a small amount of expensive gas sets the
 * price for a grid that is mostly wind.
 */
export function MeritOrder({
  plants, demand, height = 240, label,
}: {
  /** any order; sorted here */ plants: { name: string; mw: number; costPerMwh: number }[];
  demand: number; height?: number; label?: string;
}) {
  if (!plants.length) return null;
  const sorted = [...plants].sort((a, b) => a.costPerMwh - b.costPerMwh);
  const totalMw = sorted.reduce((s, p) => s + p.mw, 0);
  const maxCost = Math.max(...sorted.map((p) => p.costPerMwh)) * 1.12;
  let acc = 0;
  const blocks = sorted.map((p) => { const from = acc; acc += p.mw; return { ...p, from, to: acc }; });
  const marginal = blocks.find((b) => b.to >= demand) ?? blocks[blocks.length - 1];
  const clearing = marginal.costPerMwh;
  const unserved = Math.max(0, demand - totalMw);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        {blocks.map((b) => {
          const on = b.from < demand;
          return (
            <div key={b.name} className="absolute bottom-0 flex items-end justify-center overflow-hidden"
              style={{
                left: `${(b.from / totalMw) * 100}%`,
                width: `${(b.mw / totalMw) * 100}%`,
                // Floored: free at the margin is still a plant that is running,
                // and at 0% height wind and solar were simply absent.
                height: `${Math.max(2.5, (b.costPerMwh / maxCost) * 100)}%`,
                background: on ? TONE : "var(--muted)",
                borderRight: "1px solid var(--background)",
              }}
              title={`${b.name} · ${b.mw} MW at ${b.costPerMwh}/MWh`}>
              <span className="truncate px-0.5 pb-0.5 text-[8px]"
                style={{ color: on ? "var(--background)" : "var(--foreground)" }}>{b.name}</span>
            </div>
          );
        })}
        <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground" style={{ left: `${Math.min(100, (demand / totalMw) * 100)}%` }}>
          <span className="absolute top-0 left-1 text-[10px] font-medium whitespace-nowrap">demand {demand.toLocaleString()} MW</span>
        </div>
        <div className="absolute right-0 left-0 border-t border-foreground" style={{ bottom: `${(clearing / maxCost) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {marginal.name} is marginal, so everybody clears at {clearing}/MWh · {blocks.filter((b) => b.from < demand).length} of {blocks.length} plants running
        {unserved > 0 ? ` · ${unserved.toLocaleString()} MW unserved` : ""}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- power triangle */
/**
 * Real, reactive and apparent power, with the power factor COMPUTED from the
 * two legs — a triangle whose stated cos φ does not match its own sides is
 * the error this shape exists to make impossible.
 */
export function PowerTriangle({
  realKw, reactiveKvar, size = 260, label,
}: {
  realKw: number; reactiveKvar: number; size?: number; label?: string;
}) {
  if (realKw <= 0) return null;
  const apparent = Math.hypot(realKw, reactiveKvar);
  const pf = realKw / apparent;
  const phi = Math.atan2(reactiveKvar, realKw);
  const scale = 72 / apparent;
  const o = { x: 14, y: 82 };
  const p = { x: o.x + realKw * scale, y: o.y };
  const q = { x: p.x, y: o.y - Math.abs(reactiveKvar) * scale };

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `power factor ${pf.toFixed(2)}`}>
        <polygon points={`${o.x},${o.y} ${p.x},${p.y} ${q.x},${q.y}`} fill={TONE} fillOpacity={0.1} />
        <line x1={o.x} y1={o.y} x2={p.x} y2={p.y} stroke={TONE} strokeWidth={2} />
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={TONE} strokeWidth={2} strokeDasharray="4 2" />
        <line x1={o.x} y1={o.y} x2={q.x} y2={q.y} stroke={TONE} strokeWidth={2.4} />
        <path d={`M ${o.x + 12},${o.y} A 12 12 0 0 0 ${o.x + Math.cos(-phi) * 12},${o.y + Math.sin(-phi) * 12}`}
          fill="none" stroke={TONE} strokeWidth={0.8} />
        <text x={o.x + 15} y={o.y - 3} fontSize={4} className="fill-muted-foreground">φ {(phi * 180 / Math.PI).toFixed(1)}°</text>
        <text x={(o.x + p.x) / 2} y={o.y + 6} fontSize={4} textAnchor="middle" className="fill-foreground">P {realKw} kW</text>
        <text x={p.x + 2} y={(p.y + q.y) / 2} fontSize={4} className="fill-foreground">Q {reactiveKvar} kVAr</text>
        <text x={(o.x + q.x) / 2 - 4} y={(o.y + q.y) / 2 - 3} fontSize={4} textAnchor="end" className="fill-foreground">S {apparent.toFixed(1)} kVA</text>
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Power factor {pf.toFixed(3)} = P/S, computed from the sides ·
        {pf < 0.95 ? ` correcting to 0.95 would cut apparent power to ${(realKw / 0.95).toFixed(1)} kVA` : " already above 0.95"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- grid frequency */
/**
 * Mains frequency around nominal, with the operational band drawn.
 *
 * The interesting range is tiny — tens of millihertz — so the axis is centred
 * on nominal rather than on zero, and says so.
 */
export function GridFrequency({
  samples, nominal = 50, band = 0.2, height = 200, label,
}: {
  samples: { t: string; hz: number }[]; nominal?: number; band?: number; height?: number; label?: string;
}) {
  if (samples.length < 2) return null;
  const dev = samples.map((s) => s.hz - nominal);
  const span = Math.max(band * 1.4, ...dev.map((d) => Math.abs(d) * 1.15));
  const x = (i: number) => (i / (samples.length - 1)) * 100;
  const y = (d: number) => 50 - (d / span) * 50;
  const excursions = dev.filter((d) => Math.abs(d) > band).length;
  const worst = dev.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${excursions} samples outside ±${band} Hz`}>
        <rect x={0} y={y(band)} width={100} height={y(-band) - y(band)} fill={TONE} fillOpacity={0.08} />
        <line x1={0} y1={50} x2={100} y2={50} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
        <polyline points={dev.map((d, i) => `${x(i)},${y(d)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{samples[0].t}</span>
        <span>±{span.toFixed(2)} Hz about {nominal} Hz</span>
        <span>{samples[samples.length - 1].t}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        The shaded band is ±{band} Hz · worst excursion {worst >= 0 ? "+" : ""}{worst.toFixed(3)} Hz ·
        {excursions ? ` ${excursions} sample${excursions === 1 ? "" : "s"} outside it` : " nothing outside it"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ capacity factor */
/**
 * What each technology actually produced against what it could have.
 *
 * Nameplate capacity and output are both drawn, because a fleet's headline
 * gigawatts and its energy are different claims and only the second keeps
 * the lights on.
 */
export function CapacityFactor({
  fleet, hours = 8760, height = 230, label,
}: {
  fleet: { name: string; nameplateMw: number; outputGwh: number }[]; hours?: number; height?: number; label?: string;
}) {
  if (!fleet.length) return null;
  const rows = fleet.map((f) => ({
    ...f,
    possible: (f.nameplateMw * hours) / 1000,
    factor: (f.outputGwh * 1000) / (f.nameplateMw * hours),
  })).sort((a, b) => b.factor - a.factor);
  const maxPossible = Math.max(...rows.map((r) => r.possible));
  const totalOut = rows.reduce((s, r) => s + r.outputGwh, 0);

  return (
    <div className="w-full">
      <div className="space-y-1.5" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px] font-medium">{r.name}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {Math.round(r.factor * 100)}% of the time · {Math.round((r.outputGwh / totalOut) * 100)}% of output
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px]" style={{ width: `${(r.possible / maxPossible) * 100}%`, background: "var(--muted)" }}>
              <span className="absolute top-0 bottom-0 left-0 rounded-[2px]"
                style={{ width: `${r.factor * 100}%`, background: TONE }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Bar length is nameplate capacity, fill is what it actually generated over {hours.toLocaleString()} hours ·
        {rows[0].name} runs hardest, {rows[rows.length - 1].name} least
      </p>
    </div>
  );
}
