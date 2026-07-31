/** Signal-processing and engineering plots. Deterministic throughout. */

const TONE = "var(--foreground)";

export function srnd(s0 = 1) {
  let s = s0;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 100000) / 100000; };
}

/* -------------------------------------------------------------- bode plot */
/**
 * Gain and phase against LOG frequency, as two panels sharing an axis.
 *
 * Two panels rather than two y-axes on one: gain in dB and phase in degrees
 * have nothing in common, and a dual-axis version invites reading crossings
 * that mean nothing.
 */
export function BodePlot({
  points, height = 240, label,
}: {
  points: { freq: number; gainDb: number; phaseDeg: number }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const lgLo = Math.log10(points[0].freq), lgHi = Math.log10(points[points.length - 1].freq);
  const X = (f: number) => ((Math.log10(f) - lgLo) / (lgHi - lgLo || 1)) * 100;
  const gLo = Math.min(...points.map((p) => p.gainDb)), gHi = Math.max(...points.map((p) => p.gainDb));
  const pLo = Math.min(...points.map((p) => p.phaseDeg)), pHi = Math.max(...points.map((p) => p.phaseDeg));
  const cross = points.find((p) => p.gainDb <= gHi - 3);

  const panel = (get: (p: typeof points[0]) => number, lo: number, hi: number, guide?: number) => (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height: height / 2 - 6 }}>
      {guide !== undefined ? (
        <line x1={0} x2={100} y1={100 - ((guide - lo) / (hi - lo || 1)) * 92 - 4} y2={100 - ((guide - lo) / (hi - lo || 1)) * 92 - 4}
          stroke="var(--border)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      ) : null}
      <polyline points={points.map((p) => `${X(p.freq)},${100 - ((get(p) - lo) / (hi - lo || 1)) * 92 - 4}`).join(" ")}
        fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );

  return (
    <div className="w-full" role="img" aria-label={label ?? "Gain and phase against log frequency"}>
      <div className="text-[9px] text-muted-foreground">Gain (dB)</div>
      {panel((p) => p.gainDb, gLo, gHi, gHi - 3)}
      <div className="mt-1 text-[9px] text-muted-foreground">Phase (°)</div>
      {panel((p) => p.phaseDeg, pLo, pHi)}
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{points[0].freq} Hz</span>
        {cross ? <span>−3 dB near {Math.round(cross.freq)} Hz</span> : null}
        <span>{Math.round(points[points.length - 1].freq).toLocaleString()} Hz</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ nyquist plot */
/** The frequency response in the complex plane, with the −1 point marked. */
export function NyquistPlot({
  points, size = 250, label,
}: {
  points: { re: number; im: number }[]; size?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const res = points.map((p) => p.re), ims = points.map((p) => p.im);
  const lo = Math.min(-1.4, ...res, ...ims), hi = Math.max(1.2, ...res, ...ims);
  const P = (v: number) => ((v - lo) / (hi - lo || 1)) * 92 + 4;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Nyquist plot with the critical point marked"}>
        <line x1={P(0)} y1={2} x2={P(0)} y2={98} stroke="var(--border)" />
        <line x1={2} y1={100 - P(0)} x2={98} y2={100 - P(0)} stroke="var(--border)" />
        {/* The −1 point IS the chart: encirclement of it is what decides
            stability, so it is marked whether or not the trace goes near. */}
        <g>
          <circle cx={P(-1)} cy={100 - P(0)} r={1.6} fill="none" stroke={TONE} strokeWidth={1.2} />
          <text x={P(-1)} y={100 - P(0) - 4} textAnchor="middle" fontSize={7} className="fill-muted-foreground">−1</text>
        </g>
        <polyline points={points.map((p) => `${P(p.re)},${100 - P(p.im)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.6} />
        <polygon points={`${P(points[1].re)},${100 - P(points[1].im)} ${P(points[1].re) - 2.4},${100 - P(points[1].im) - 1.4} ${P(points[1].re) - 2.4},${100 - P(points[1].im) + 1.4}`} fill={TONE} />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Real across, imaginary up · stability hangs on the ringed −1</p>
    </div>
  );
}

/* -------------------------------------------------------------- smith chart */
/** Impedance on the reflection plane: resistance circles, reactance arcs. */
export function SmithChart({
  trace, size = 260, label,
}: {
  /** Normalised impedances along a sweep. */ trace: { r: number; x: number }[]; size?: number; label?: string;
}) {
  const C = 50, R = 46;
  const gamma = (r: number, x: number) => {
    const d = (r + 1) ** 2 + x ** 2 || 1;
    return { re: (r * r + x * x - 1) / d, im: (2 * x) / d };
  };
  const rCircles = [0, 1 / 3, 1, 3];
  const xArcs = [0.5, 1, 2];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Impedance sweep on a Smith chart"}>
        <defs>
          <clipPath id="smith-clip"><circle cx={C} cy={C} r={R} /></clipPath>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke={TONE} strokeWidth={1} />
        <line x1={C - R} x2={C + R} y1={C} y2={C} stroke="var(--border)" />
        {rCircles.map((r) => (
          <circle key={r} cx={C + (r / (r + 1)) * R} cy={C} r={R / (r + 1)} fill="none" stroke="var(--border)" strokeWidth={0.7} />
        ))}
        <g clipPath="url(#smith-clip)">
          {xArcs.map((x) => (
            <g key={x}>
              <circle cx={C + R} cy={C - R / x} r={R / x} fill="none" stroke="var(--border)" strokeWidth={0.7} />
              <circle cx={C + R} cy={C + R / x} r={R / x} fill="none" stroke="var(--border)" strokeWidth={0.7} />
            </g>
          ))}
          {trace.length > 1 ? (
            <polyline points={trace.map((t) => { const g = gamma(t.r, t.x); return `${C + g.re * R},${C - g.im * R}`; }).join(" ")}
              fill="none" stroke={TONE} strokeWidth={1.8} />
          ) : null}
        </g>
        {trace.length ? (() => { const g = gamma(trace[0].r, trace[0].x); return <circle cx={C + g.re * R} cy={C - g.im * R} r={1.6} fill={TONE} />; })() : null}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Circles are constant resistance, arcs constant reactance · centre is a perfect match</p>
    </div>
  );
}

/* --------------------------------------------------------------- lissajous */
/** Two frequencies against each other. The figure names their ratio. */
export function Lissajous({
  a = 3, b = 2, phase = Math.PI / 2, size = 240, steps = 400, label,
}: {
  a?: number; b?: number; phase?: number; size?: number; steps?: number; label?: string;
}) {
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    return `${50 + Math.sin(a * t + phase) * 44},${50 + Math.sin(b * t) * 44}`;
  });
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `Lissajous figure at ${a}:${b}`}>
        <polyline points={pts.join(" ")} fill="none" stroke={TONE} strokeWidth={1.2} strokeOpacity={0.85} />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Frequency ratio {a}:{b} — the loop count on each axis says so</p>
    </div>
  );
}

/* ---------------------------------------------------------------- waveform */
/** An audio-style amplitude envelope, mirrored about the centre line. */
export function Waveform({
  samples, height = 130, playhead, label,
}: {
  samples: number[]; height?: number; /** 0-1 position. */ playhead?: number; label?: string;
}) {
  if (!samples.length) return null;
  const hi = Math.max(...samples.map(Math.abs)) || 1;
  const w = 100 / samples.length;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${samples.length} amplitude samples`}>
      <div className="absolute top-1/2 right-0 left-0 border-t border-border" />
      {samples.map((v, i) => {
        const h = (Math.abs(v) / hi) * 48;
        return (
          <div key={i} className="absolute rounded-full"
            style={{ left: `${i * w}%`, width: `${w * 0.66}%`, top: `${50 - h}%`, height: `${h * 2}%`, background: TONE, opacity: 0.75 }} />
        );
      })}
      {playhead !== undefined ? (
        <div className="absolute top-0 bottom-0 w-px bg-destructive" style={{ left: `${playhead * 100}%` }} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- eye diagram */
/**
 * Many two-symbol slices of a data signal, overlaid.
 *
 * The OVERLAY is the instrument: one trace shows a waveform, hundreds show
 * the opening — and the size of the clear "eye" in the middle is the margin
 * the receiver actually has.
 */
export function EyeDiagram({
  height = 210, traces = 60, seed = 5, label,
}: {
  height?: number; traces?: number; seed?: number; label?: string;
}) {
  const r = srnd(seed);
  const lines: string[][] = [];
  let prev = r() > 0.5 ? 1 : -1;
  for (let t = 0; t < traces; t++) {
    const a = prev;
    const b = r() > 0.5 ? 1 : -1;
    const c = r() > 0.5 ? 1 : -1;
    prev = c;
    const jit = (r() - 0.5) * 0.08;
    const noise = () => (r() - 0.5) * 0.14;
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 20 - 1; // -1..1 in UI units, transition at 0
      const base = u < 0
        ? a + (b - a) * (1 / (1 + Math.exp(-((u + 0.5 + jit) * 14))))
        : b + (c - b) * (1 / (1 + Math.exp(-((u - 0.5 + jit) * 14))));
      pts.push(`${(u + 1) * 50},${50 - (base + noise()) * 34}`);
    }
    lines.push(pts);
  }
  return (
    <div className="w-full" role="img" aria-label={label ?? `${traces} overlaid symbol slices`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        {lines.map((pts, i) => (
          <polyline key={i} points={pts.join(" ")} fill="none" stroke={TONE} strokeOpacity={0.14} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">The open eye in the middle is the sampling margin</p>
    </div>
  );
}

/* ------------------------------------------------------------ constellation */
/** Received symbols scattered around the ideal 16-QAM grid. */
export function ConstellationDiagram({
  perSymbol = 18, noise = 0.16, size = 240, seed = 11, label,
}: {
  perSymbol?: number; noise?: number; size?: number; seed?: number; label?: string;
}) {
  const r = srnd(seed);
  const ideals: { x: number; y: number }[] = [];
  for (const x of [-3, -1, 1, 3]) for (const y of [-3, -1, 1, 3]) ideals.push({ x, y });
  const P = (v: number) => 50 + v * 11.5;
  let errSum = 0, n = 0;

  const rx = ideals.flatMap((s) =>
    Array.from({ length: perSymbol }, () => {
      const dx = (r() + r() - 1) * noise * 3, dy = (r() + r() - 1) * noise * 3;
      errSum += dx * dx + dy * dy; n++;
      return { x: s.x + dx, y: s.y + dy };
    })
  );
  const evm = Math.sqrt(errSum / n) / 3;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "16-QAM constellation"}>
        <line x1={50} y1={2} x2={50} y2={98} stroke="var(--border)" />
        <line x1={2} y1={50} x2={98} y2={50} stroke="var(--border)" />
        {rx.map((p, i) => <circle key={i} cx={P(p.x)} cy={100 - P(p.y)} r={0.9} fill={TONE} fillOpacity={0.4} />)}
        {ideals.map((s, i) => <circle key={`i-${i}`} cx={P(s.x)} cy={100 - P(s.y)} r={1.4} fill="none" stroke={TONE} strokeWidth={0.8} />)}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Rings are the ideal symbols · EVM ~{(evm * 100).toFixed(0)}%</p>
    </div>
  );
}

/* ------------------------------------------------------------ stress-strain */
/** The tensile test curve with its named points marked. */
export function StressStrain({
  points, yieldAt, ultimateAt, height = 220, label,
}: {
  points: { strain: number; stress: number }[];
  /** Indices into points. */ yieldAt: number; ultimateAt: number;
  height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const sHi = Math.max(...points.map((p) => p.stress));
  const eHi = Math.max(...points.map((p) => p.strain));
  const X = (e: number) => (e / (eHi || 1)) * 96 + 2;
  const Y = (s: number) => 100 - (s / (sHi || 1)) * 92 - 4;
  const yp = points[yieldAt], up = points[ultimateAt], fp = points[points.length - 1];

  return (
    <div className="w-full" role="img" aria-label={label ?? "Stress against strain"}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={points.map((p) => `${X(p.strain)},${Y(p.stress)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {[{ p: yp, t: "yield" }, { p: up, t: "ultimate" }, { p: fp, t: "fracture" }].map(({ p, t }) => (
            <g key={t}>
              <circle cx={X(p.strain)} cy={Y(p.stress)} r={1.6} fill="var(--background)" stroke={TONE} strokeWidth={1.2} />
              <text x={X(p.strain)} y={Y(p.stress) - 4} textAnchor="middle" fontSize={6.5} className="fill-muted-foreground">{t}</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        The straight start is elastic — everything past yield is permanent
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ S-N curve */
/** Stress amplitude against cycles to failure, both axes doing real work. */
export function SnCurve({
  points, enduranceLimit, height = 220, label,
}: {
  points: { cycles: number; stress: number }[]; enduranceLimit?: number;
  height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const lgLo = Math.log10(Math.min(...points.map((p) => p.cycles)));
  const lgHi = Math.log10(Math.max(...points.map((p) => p.cycles)));
  const sLo = Math.min(...points.map((p) => p.stress), enduranceLimit ?? Infinity);
  const sHi = Math.max(...points.map((p) => p.stress));
  const X = (c: number) => ((Math.log10(c) - lgLo) / (lgHi - lgLo || 1)) * 94 + 3;
  const Y = (s: number) => 100 - ((s - sLo) / (sHi - sLo || 1)) * 88 - 6;

  return (
    <div className="w-full" role="img" aria-label={label ?? "Fatigue life"}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {enduranceLimit !== undefined ? (
            <line x1={0} x2={100} y1={Y(enduranceLimit)} y2={Y(enduranceLimit)} stroke={TONE} strokeOpacity={0.45} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          ) : null}
          {points.map((p, i) => (
            <circle key={i} cx={X(p.cycles)} cy={Y(p.stress)} r={1.4} fill={TONE} fillOpacity={0.75} />
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Cycles on a log axis{enduranceLimit !== undefined ? " · below the dashed limit it lasts indefinitely" : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- recurrence plot */
/** When does the system revisit a state: dark where |xᵢ − xⱼ| is small. */
export function RecurrencePlot({
  values, epsilon, size = 240, label,
}: {
  values: number[]; epsilon?: number; size?: number; label?: string;
}) {
  const n = values.length;
  if (n < 4) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const eps = epsilon ?? (hi - lo) * 0.1;
  const cell = 100 / n;
  const cells: { i: number; j: number }[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (Math.abs(values[i] - values[j]) < eps) cells.push({ i, j });
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Recurrence structure"}>
        {cells.map((c, k) => (
          <rect key={k} x={c.i * cell} y={100 - (c.j + 1) * cell} width={cell + 0.05} height={cell + 0.05} fill={TONE} fillOpacity={0.8} />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Diagonal stripes are repeated motifs · blocks are states it lingers in
      </p>
    </div>
  );
}
