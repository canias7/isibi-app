/** Hydrology: flow, storage and where the water in a catchment goes. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------- flow duration */
/**
 * River flow sorted by size, on a log axis, against exceedance probability.
 *
 * Q95 — the flow exceeded 95% of the time — is what an abstraction licence is
 * written against, and it is read off the curve here rather than supplied.
 */
export function FlowDurationCurve({
  flows, height = 250, label,
}: {
  /** daily mean flows, any order */ flows: number[]; height?: number; label?: string;
}) {
  if (flows.length < 5) return null;
  const sorted = [...flows].sort((a, b) => b - a);
  const n = sorted.length;
  const at = (p: number) => sorted[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
  const q95 = at(0.95), q50 = at(0.5), q10 = at(0.1);
  const lo = Math.max(0.01, Math.min(...sorted)) * 0.7, hi = Math.max(...sorted) * 1.3;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - ((Math.log10(Math.max(0.01, v)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `Q95 ${q95.toFixed(2)}`}>
        {[0.1, 0.5, 0.95].map((p) => (
          <line key={p} x1={p * 100} y1={0} x2={p * 100} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={sorted.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-1 h-3.5">
        {[["Q10", 0.1], ["Q50", 0.5], ["Q95", 0.95]].map(([n2, p]) => (
          <span key={String(n2)} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground" style={{ left: `${(p as number) * 100}%` }}>{n2}</span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Log flow against how often it is exceeded · Q10 {q10.toFixed(2)}, Q50 {q50.toFixed(2)},
        Q95 {q95.toFixed(2)} m³/s — Q95 is what a licence is written against
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- rating curve */
/**
 * Stage against discharge, with the EXTRAPOLATED part marked.
 *
 * Almost every big flood is estimated beyond the highest gauging ever made, and
 * a curve that does not say where measurement stopped invites reading a number
 * that was never measured as if it were.
 */
export function RatingCurve({
  gaugings, fitted, height = 250, label,
}: {
  gaugings: { stage: number; discharge: number }[];
  fitted: { stage: number; discharge: number }[]; height?: number; label?: string;
}) {
  if (!fitted.length) return null;
  const maxMeasured = Math.max(...gaugings.map((g) => g.stage));
  const hiQ = Math.max(...fitted.map((f) => f.discharge)) * 1.05;
  const hiS = Math.max(...fitted.map((f) => f.stage)) * 1.05;
  const x = (q: number) => (q / hiQ) * 100;
  const y = (s: number) => 100 - (s / hiS) * 100;
  const measured = fitted.filter((f) => f.stage <= maxMeasured);
  const beyond = fitted.filter((f) => f.stage >= maxMeasured);
  const topQ = fitted[fitted.length - 1].discharge;
  const measuredQ = measured.length ? measured[measured.length - 1].discharge : 0;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `measured to ${measuredQ.toFixed(0)}`}>
          <line x1={0} y1={y(maxMeasured)} x2={100} y2={y(maxMeasured)}
            stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          <polyline points={measured.map((f) => `${x(f.discharge)},${y(f.stage)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <polyline points={beyond.map((f) => `${x(f.discharge)},${y(f.stage)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        </svg>
        {gaugings.map((g, i) => (
          <span key={i} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(g.discharge)}%`, top: `${y(g.stage)}%`, background: "var(--background)", boxShadow: `inset 0 0 0 1.5px ${TONE}` }}
            title={`${g.stage} m → ${g.discharge} m³/s`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span><span>discharge m³/s →</span><span>{Math.round(hiQ)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Rings are actual gaugings · solid is within them, DASHED is extrapolated beyond
        {" "}{maxMeasured.toFixed(2)} m — {Math.round(((topQ - measuredQ) / topQ) * 100)}% of the curve's range was never measured
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- reservoir storage */
/**
 * Storage against the drought curve for the time of year.
 *
 * Percentage full alone is meaningless without the season — 60% in March is a
 * problem and in September is normal — so it is drawn against the control curve.
 */
export function ReservoirStorage({
  months, control, height = 240, label,
}: {
  months: { label: string; percentFull: number }[]; control: number[]; height?: number; label?: string;
}) {
  if (!months.length) return null;
  const x = (i: number) => (i / Math.max(1, months.length - 1)) * 100;
  const y = (v: number) => 100 - v * 100;
  const below = months.filter((m, i) => m.percentFull < (control[i] ?? 0));
  const now = months[months.length - 1];
  const nowControl = control[months.length - 1] ?? 0;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${Math.round(now.percentFull * 100)}% full`}>
        <polygon points={`0,100 ${control.map((c, i) => `${x(i)},${y(c)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.1} />
        <polyline points={control.map((c, i) => `${x(i)},${y(c)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.4} strokeDasharray="5 3" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
        <polyline points={months.map((m, i) => `${x(i)},${y(m.percentFull)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex">
        {months.map((m) => <span key={m.label} className="flex-1 text-center text-[9px] text-muted-foreground">{m.label}</span>)}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Dashed is the control curve for the season · now {Math.round(now.percentFull * 100)}% against
        {" "}{Math.round(nowControl * 100)}% expected · {below.length ? `${below.length} months below it` : "never below it"}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- water balance */
/**
 * Where the rain went: runoff, recharge, evaporation and the change in store.
 *
 * The parts must CLOSE against the rainfall, and the residual is shown — a
 * balance that does not close is telling you a term is wrong.
 */
export function WaterBalance({
  periods, height = 240, label,
}: {
  periods: { label: string; rainfall: number; runoff: number; recharge: number; evaporation: number }[];
  height?: number; label?: string;
}) {
  if (!periods.length) return null;
  const rows = periods.map((p) => ({
    ...p, residual: p.rainfall - p.runoff - p.recharge - p.evaporation,
  }));
  const max = Math.max(...rows.map((r) => r.rainfall)) * 1.1;
  const worst = rows.reduce((a, b) => (Math.abs(b.residual) > Math.abs(a.residual) ? b : a));

  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="flex h-full flex-1 items-end gap-[3px]">
            <div className="flex-1" style={{ height: `${(r.rainfall / max) * 100}%`, background: TONE, opacity: 0.22 }} title={`rain ${r.rainfall}`} />
            <div className="flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
              <span style={{ height: `${(r.evaporation / max) * 100}%`, background: TONE, opacity: 0.45 }} title={`evaporation ${r.evaporation}`} />
              <span style={{ height: `${(r.recharge / max) * 100}%`, background: TONE, opacity: 0.72 }} title={`recharge ${r.recharge}`} />
              <span style={{ height: `${(r.runoff / max) * 100}%`, background: TONE }} title={`runoff ${r.runoff}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {rows.map((r) => <span key={r.label} className="flex-1 text-center text-[9px] text-muted-foreground">{r.label}</span>)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE, opacity: 0.22 }} />rainfall</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE }} />runoff</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE, opacity: 0.72 }} />recharge</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE, opacity: 0.45 }} />evaporation</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        The three outputs are stacked against the rainfall beside them · largest unclosed residual is
        {" "}{worst.residual >= 0 ? "+" : ""}{worst.residual.toFixed(0)} mm in {worst.label}, which is change in storage or a term that is wrong
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ catchment profile */
/**
 * A river's long profile from source to mouth, with tributaries joining.
 *
 * The vertical exaggeration is STATED, because every long profile has one and a
 * gorge and a floodplain look identical without it.
 */
export function CatchmentProfile({
  points, tributaries = [], exaggeration, height = 220, label,
}: {
  points: { km: number; metres: number }[];
  tributaries?: { km: number; name: string }[]; exaggeration?: number; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const maxKm = Math.max(...points.map((p) => p.km));
  const maxM = Math.max(...points.map((p) => p.metres));
  const x = (km: number) => (km / maxKm) * 100;
  const y = (m: number) => 100 - (m / (maxM * 1.08)) * 100;
  // Stated rather than assumed: km against metres over the drawn box.
  const vx = exaggeration ?? Math.round((maxKm * 1000) / maxM / (100 / 100));
  const drop = points[0].metres - points[points.length - 1].metres;
  const meanSlope = (drop / (maxKm * 1000)) * 100;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${drop} m over ${maxKm} km`}>
          <polygon points={`0,100 ${points.map((p) => `${x(p.km)},${y(p.metres)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.16} />
          <polyline points={points.map((p) => `${x(p.km)},${y(p.metres)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {tributaries.map((t) => (
            <line key={t.name} x1={x(t.km)} y1={0} x2={x(t.km)} y2={100}
              stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <div className="relative mt-1 h-3.5">
        {tributaries.map((t) => (
          <span key={t.name} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(92, Math.max(8, x(t.km)))}%` }}>{t.name}</span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>source {points[0].metres} m</span><span>{maxKm} km</span><span>mouth {points[points.length - 1].metres} m</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Vertical exaggeration about ×{vx.toLocaleString()} — every long profile has one, and a gorge and a floodplain
        look the same without it · mean slope {meanSlope.toFixed(2)}%
      </p>
    </div>
  );
}
