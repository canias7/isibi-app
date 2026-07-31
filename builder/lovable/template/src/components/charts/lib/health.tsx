/** Clinical chart forms. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------- growth chart */
/** Percentile curves with one child's measurements plotted through them. */
export function GrowthChart({
  ages, percentiles, child, height = 250, unit = "kg", label,
}: {
  ages: number[]; /** percentiles["P3"|"P50"...] one value per age. */
  percentiles: Record<string, number[]>; child: { age: number; value: number }[];
  height?: number; unit?: string; label?: string;
}) {
  const keys = Object.keys(percentiles);
  if (!keys.length || !ages.length) return null;
  const all = keys.flatMap((k) => percentiles[k]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const aHi = ages[ages.length - 1];
  const X = (a: number) => (a / (aHi || 1)) * 96 + 2;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 92 - 4;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${child.length} measurements against ${keys.length} percentile curves`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {keys.map((k) => (
            <polyline key={k} points={percentiles[k].map((v, i) => `${X(ages[i])},${Y(v)}`).join(" ")}
              fill="none" stroke={TONE} strokeOpacity={k === "P50" ? 0.7 : 0.28}
              strokeWidth={k === "P50" ? 1.4 : 1} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={child.map((c) => `${X(c.age)},${Y(c.value)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {keys.map((k) => (
          <span key={k} className="absolute -translate-y-1/2 pl-1 text-[8px] text-muted-foreground"
            style={{ left: "98%", top: `${Y(percentiles[k][percentiles[k].length - 1])}%` }}>{k}</span>
        ))}
        {child.map((c, i) => (
          <span key={i} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: `${X(c.age)}%`, top: `${Y(c.value)}%`, borderColor: TONE, background: "var(--background)" }} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Months across, {unit} up · tracking a centile is what matters, not the level</p>
    </div>
  );
}

/* -------------------------------------------------------------- audiogram */
/**
 * Hearing thresholds by frequency, y-axis INVERTED — 0 dB at the top.
 *
 * That inversion is the clinical convention and it is load-bearing: worse
 * hearing plots LOWER, so a downward slope reads as loss. Right ear is O,
 * left is X, which is also the standard and not a styling choice.
 */
export function Audiogram({
  freqs = [125, 250, 500, 1000, 2000, 4000, 8000], right, left, height = 240, label,
}: {
  freqs?: number[]; right: number[]; left: number[]; height?: number; label?: string;
}) {
  if (!right.length) return null;
  const X = (i: number) => (i / (freqs.length - 1 || 1)) * 92 + 4;
  const Y = (db: number) => (db / 90) * 88 + 6;
  const worst = Math.max(...right, ...left);

  return (
    <div className="w-full" role="img" aria-label={label ?? `Worst threshold ${worst} dB`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={Y(0)} width={100} height={Y(20) - Y(0)} fill={TONE} fillOpacity={0.06} />
          {[0, 20, 40, 60, 80].map((db) => (
            <line key={db} x1={2} x2={98} y1={Y(db)} y2={Y(db)} stroke="var(--border)" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={right.map((db, i) => `${X(i)},${Y(db)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <polyline points={left.map((db, i) => `${X(i)},${Y(db)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        </svg>
        {right.map((db, i) => (
          <span key={`r-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px]" style={{ left: `${X(i)}%`, top: `${Y(db)}%`, color: TONE }}>○</span>
        ))}
        {left.map((db, i) => (
          <span key={`l-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px]" style={{ left: `${X(i)}%`, top: `${Y(db)}%`, color: TONE }}>×</span>
        ))}
      </div>
      <div className="flex justify-between px-1">
        {freqs.map((f) => <span key={f} className="text-[9px] tabular-nums text-muted-foreground">{f >= 1000 ? f / 1000 + "k" : f}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">0 dB at the TOP — down is worse · ○ right, × left · shaded is normal</p>
    </div>
  );
}

/* -------------------------------------------------------------- ECG strip */
/** A synthesised trace on the standard calibration grid. */
export function EcgStrip({
  beats = 4, rate = 72, height = 170, label,
}: {
  beats?: number; rate?: number; height?: number; label?: string;
}) {
  const per = 220;
  const n = beats * per;
  const bump = (t: number, c: number, w: number, a: number) => a * Math.exp(-((t - c) ** 2) / (2 * w * w));
  const sample = (i: number) => {
    const t = i % per;
    return bump(t, 40, 9, 0.16)      // P
      + bump(t, 86, 2.2, -0.14)      // Q
      + bump(t, 92, 2.6, 1.1)        // R
      + bump(t, 99, 2.4, -0.26)      // S
      + bump(t, 150, 14, 0.3);       // T
  };
  const pts = Array.from({ length: n }, (_, i) => `${(i / (n - 1)) * 100},${62 - sample(i) * 44}`);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rate} beats per minute`}>
      <div className="relative overflow-hidden rounded-[3px] border border-border" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {Array.from({ length: 26 }, (_, i) => (
            <line key={`v${i}`} x1={i * 4} x2={i * 4} y1={0} y2={100} stroke="var(--border)" strokeOpacity={i % 5 ? 0.35 : 0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`h${i}`} x1={0} x2={100} y1={i * 8} y2={i * 8} stroke="var(--border)" strokeOpacity={i % 5 ? 0.35 : 0.8} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={pts.join(" ")} fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">P, QRS and T on the standard grid · {rate} bpm equivalent spacing</p>
    </div>
  );
}

/* ----------------------------------------------------------- dose-response */
/** The sigmoid against log dose, with the EC50 derived from the curve. */
export function DoseResponse({
  doses, responses, height = 220, unit = "mg", label,
}: {
  doses: number[]; responses: number[]; height?: number; unit?: string; label?: string;
}) {
  if (doses.length < 3) return null;
  const lgLo = Math.log10(doses[0]), lgHi = Math.log10(doses[doses.length - 1]);
  const X = (d: number) => ((Math.log10(d) - lgLo) / (lgHi - lgLo || 1)) * 94 + 3;
  const rHi = Math.max(...responses);
  const Y = (v: number) => 100 - (v / (rHi || 1)) * 90 - 5;
  // EC50 read off the data by interpolation, not passed in — a hand-supplied
  // EC50 drifts off the curve the moment the data changes.
  const half = rHi / 2;
  let ec50 = doses[0];
  for (let i = 1; i < doses.length; i++) {
    if (responses[i] >= half) {
      const t = (half - responses[i - 1]) / (responses[i] - responses[i - 1] || 1);
      ec50 = Math.pow(10, Math.log10(doses[i - 1]) + t * (Math.log10(doses[i]) - Math.log10(doses[i - 1])));
      break;
    }
  }

  return (
    <div className="w-full" role="img" aria-label={label ?? `EC50 near ${ec50.toPrecision(2)} ${unit}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={X(ec50)} y1={Y(half)} x2={X(ec50)} y2={100} stroke={TONE} strokeOpacity={0.45} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={Y(half)} x2={X(ec50)} y2={Y(half)} stroke={TONE} strokeOpacity={0.45} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <polyline points={doses.map((d, i) => `${X(d)},${Y(responses[i])}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {doses.map((d, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${X(d)}%`, top: `${Y(responses[i])}%`, background: TONE }} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Log dose across · half-maximal effect at about {ec50.toPrecision(2)} {unit}
      </p>
    </div>
  );
}

/* ------------------------------------------------------- blood pressure */
/** Paired systolic/diastolic readings against the guideline lines. */
export function BloodPressure({
  readings, height = 230, label,
}: {
  readings: { label: string; sys: number; dia: number }[]; height?: number; label?: string;
}) {
  if (!readings.length) return null;
  const lo = 50, hi = 190;
  const X = (i: number) => (i / (readings.length - 1 || 1)) * 92 + 4;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 92 - 4;
  const high = readings.filter((r) => r.sys >= 140 || r.dia >= 90).length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${high} readings in the high range`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[{ v: 140, t: "140 sys" }, { v: 90, t: "90 dia" }].map((g) => (
            <g key={g.v}>
              <line x1={0} x2={100} y1={Y(g.v)} y2={Y(g.v)} stroke={TONE} strokeOpacity={0.35} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {readings.map((r, i) => (
            <line key={i} x1={X(i)} x2={X(i)} y1={Y(r.sys)} y2={Y(r.dia)} stroke={TONE} strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {readings.map((r, i) => (
          <span key={`s-${i}`}>
            <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${X(i)}%`, top: `${Y(r.sys)}%`, background: TONE }} title={`${r.label}: ${r.sys}/${r.dia}`} />
            <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{ left: `${X(i)}%`, top: `${Y(r.dia)}%`, borderColor: TONE, background: "var(--background)" }} />
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid systolic, hollow diastolic, joined per visit · dashed are the 140/90 lines
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- lab results */
/** A result over time inside its reference range; out-of-range ringed. */
export function LabResults({
  tests, range, height = 210, unit = "", label,
}: {
  tests: { label: string; value: number }[]; range: { lo: number; hi: number };
  height?: number; unit?: string; label?: string;
}) {
  if (!tests.length) return null;
  const vLo = Math.min(range.lo, ...tests.map((t) => t.value));
  const vHi = Math.max(range.hi, ...tests.map((t) => t.value));
  const pad = (vHi - vLo) * 0.1 || 1;
  const X = (i: number) => (i / (tests.length - 1 || 1)) * 92 + 4;
  const Y = (v: number) => 100 - ((v - vLo + pad) / (vHi - vLo + pad * 2)) * 100;
  const out = tests.filter((t) => t.value < range.lo || t.value > range.hi);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${out.length} results outside the reference range`}>
      <div className="relative" style={{ height }}>
        <div className="absolute right-0 left-0" style={{ top: `${Y(range.hi)}%`, height: `${Y(range.lo) - Y(range.hi)}%`, background: TONE, opacity: 0.08 }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={tests.map((t, i) => `${X(i)},${Y(t.value)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {tests.map((t, i) => {
          const bad = t.value < range.lo || t.value > range.hi;
          return bad ? (
            <span key={i} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${X(i)}%`, top: `${Y(t.value)}%`, borderColor: TONE, background: "var(--background)" }}
              title={`${t.label}: ${t.value}${unit} — outside range`} />
          ) : (
            <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${X(i)}%`, top: `${Y(t.value)}%`, background: TONE }} title={`${t.label}: ${t.value}${unit}`} />
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Shaded is the reference range {range.lo}–{range.hi}{unit} · ringed points fall outside it
      </p>
    </div>
  );
}
