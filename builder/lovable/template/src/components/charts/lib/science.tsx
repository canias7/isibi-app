/** Scientific and engineering plots. */

const TONE = "var(--foreground)";
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${Math.round(6 + t * 88)}%, var(--muted))`;

/* ------------------------------------------------------------ spectrogram */
/**
 * Time across, frequency up, intensity as shade.
 *
 * Frequency is drawn on a LOG axis: a linear one squeezes everything audible
 * into the bottom fifth and leaves most of the picture empty.
 */
export function Spectrogram({
  frames, height = 220, logFreq = true, label,
}: {
  /** frames[time][freqBin] */ frames: number[][];
  height?: number; logFreq?: boolean; label?: string;
}) {
  if (!frames.length) return null;
  const bins = frames[0].length;
  const hi = Math.max(...frames.flat()) || 1;
  const rowFor = (b: number) => (logFreq ? Math.log(b + 1) / Math.log(bins) : b / bins);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${frames.length} frames across ${bins} bands`}>
      <svg viewBox={`0 0 ${frames.length} 100`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {frames.map((f, t) =>
          f.map((v, b) => {
            const y0 = 100 - rowFor(b + 1) * 100;
            const y1 = 100 - rowFor(b) * 100;
            return <rect key={`${t}-${b}`} x={t} y={y0} width={1.05} height={Math.max(0.4, y1 - y0)} fill={SHADE(v / hi)} />;
          })
        )}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Time across · frequency up{logFreq ? ", log scale" : ""}</p>
    </div>
  );
}

/* --------------------------------------------------------- phase portrait */
/** Value against its own rate of change. A closed loop means a cycle. */
export function PhasePortrait({
  values, size = 250, label,
}: {
  values: number[]; size?: number; label?: string;
}) {
  if (values.length < 3) return null;
  const pts = values.slice(1).map((v, i) => ({ x: values[i], y: v - values[i] }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const yB = Math.max(...ys.map(Math.abs)) || 1;
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 88 + 6;
  const Y = (v: number) => 50 - (v / yB) * 44;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Value against its rate of change"}>
        <line x1={2} y1={50} x2={98} y2={50} stroke="var(--border)" />
        <polyline points={pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1} strokeOpacity={0.7} />
        {pts.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={1.1} fill={TONE} fillOpacity={0.5} />)}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">A closed loop means a cycle · drift means a trend</p>
    </div>
  );
}

/* ---------------------------------------------------------- Poincaré plot */
/** Each value against the next. Ellipse width is short-term variability. */
export function PoincarePlot({
  values, size = 250, label,
}: {
  values: number[]; size?: number; label?: string;
}) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const P = (v: number) => ((v - lo) / (hi - lo || 1)) * 88 + 6;
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  const sd1 = Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length / 2);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `SD1 ${sd1.toFixed(2)}`}>
        <line x1={6} y1={94} x2={94} y2={6} stroke="var(--border)" strokeDasharray="3 3" />
        {values.slice(1).map((v, i) => (
          <circle key={i} cx={P(values[i])} cy={100 - P(v)} r={1.5} fill={TONE} fillOpacity={0.6} />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Spread across the diagonal is short-term variability (SD1 {sd1.toFixed(2)})
      </p>
    </div>
  );
}

/* ------------------------------------------------------ bifurcation diagram */
/**
 * The logistic map's attractor against its growth parameter — the classic
 * period-doubling route to chaos.
 *
 * Transients are DISCARDED before plotting: without that the picture is a
 * smear and the doubling structure never appears.
 */
export function Bifurcation({
  from = 2.5, to = 4, steps = 340, settle = 180, keep = 60, size = 300, label,
}: {
  from?: number; to?: number; steps?: number; settle?: number; keep?: number; size?: number; label?: string;
}) {
  const pts: { r: number; x: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const r = from + ((to - from) * i) / (steps - 1);
    let x = 0.5;
    for (let k = 0; k < settle; k++) x = r * x * (1 - x);
    for (let k = 0; k < keep; k++) { x = r * x * (1 - x); pts.push({ r, x }); }
  }
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Logistic map bifurcation"}>
        {pts.map((p, i) => (
          <rect key={i} x={((p.r - from) / (to - from)) * 100} y={(1 - p.x) * 100} width={0.35} height={0.35} fill={TONE} fillOpacity={0.35} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>r = {from}</span><span>period doubling into chaos</span><span>r = {to}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ streamlines */
/** Paths traced through a vector field, rather than arrows at grid points. */
export function Streamlines({
  field, seeds, width = 320, height = 230, steps = 34, label,
}: {
  /** Returns [dx, dy] at a normalised point. */ field: (x: number, y: number) => [number, number];
  seeds: { x: number; y: number }[]; width?: number; height?: number; steps?: number; label?: string;
}) {
  if (!seeds.length) return null;
  const paths = seeds.map((s) => {
    const pts: string[] = [];
    let { x, y } = s;
    for (let i = 0; i < steps; i++) {
      pts.push(`${(x * width).toFixed(1)},${((1 - y) * height).toFixed(1)}`);
      const [dx, dy] = field(x, y);
      const m = Math.hypot(dx, dy) || 1;
      x += (dx / m) * 0.028;
      y += (dy / m) * 0.028;
      if (x < 0 || x > 1 || y < 0 || y > 1) break;
    }
    return pts.join(" ");
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${seeds.length} streamlines`}>
      {paths.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke={TONE} strokeOpacity={0.5} strokeWidth={1.1} strokeLinecap="round" />
      ))}
      {seeds.map((s, i) => (
        <circle key={i} cx={s.x * width} cy={(1 - s.y) * height} r={1.6} fill={TONE} fillOpacity={0.8} />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------- nomogram */
/**
 * Parallel scales you read a value off by laying a line across them.
 *
 * The isopleth is drawn for one worked example, because a nomogram with no
 * line on it is three number lines and teaches nobody how to use it.
 */
export function Nomogram({
  scales, example, height = 250, label,
}: {
  scales: { label: string; min: number; max: number; format?: (n: number) => string }[];
  /** One value per scale — the line drawn across them. */ example?: number[];
  height?: number; label?: string;
}) {
  if (scales.length < 2) return null;
  const X = (i: number) => (i / (scales.length - 1)) * 84 + 8;
  const Y = (i: number, v: number) => 92 - ((v - scales[i].min) / (scales[i].max - scales[i].min || 1)) * 84;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}
        role="img" aria-label={label ?? `${scales.length} parallel scales`}>
        {scales.map((s, i) => (
          <g key={s.label}>
            <line x1={X(i)} y1={8} x2={X(i)} y2={92} stroke={TONE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {Array.from({ length: 6 }, (_, k) => {
              const v = s.min + ((s.max - s.min) * k) / 5;
              return <line key={k} x1={X(i) - 1.2} x2={X(i) + 1.2} y1={Y(i, v)} y2={Y(i, v)} stroke={TONE} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
            })}
          </g>
        ))}
        {example?.length === scales.length ? (
          <polyline points={example.map((v, i) => `${X(i)},${Y(i, v)}`).join(" ")} fill="none"
            stroke={TONE} strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {scales.map((s, i) => (
          <span key={s.label} className="text-center">
            {s.label}
            {example ? <span className="block tabular-nums">{(s.format ?? String)(example[i])}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Deterministic spectrogram frames: a rising tone plus a steady hum. */
export function sampleFrames(t = 90, bins = 40): number[][] {
  return Array.from({ length: t }, (_, ti) =>
    Array.from({ length: bins }, (_, b) => {
      const sweep = Math.exp(-Math.pow(b - (4 + (ti / t) * 26), 2) / 12);
      const hum = b < 4 ? 0.7 : 0;
      const noise = ((ti * 31 + b * 17) % 11) / 60;
      return sweep + hum + noise;
    })
  );
}
