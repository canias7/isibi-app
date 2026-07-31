/** Chemistry and physics: the plots those fields actually draw. */

const TONE = "var(--foreground)";

/* ----------------------------------------------------------- periodic grid */
/**
 * The periodic table as a value grid — a heatmap whose LAYOUT is the data.
 *
 * Group and period place every element, so the shape carries the trend
 * (down a group, across a period) that a sorted bar chart of the same numbers
 * destroys.
 */
export function PeriodicGrid({
  elements, unit, size = 460, label,
}: {
  elements: { symbol: string; group: number; period: number; value: number }[];
  unit?: string; size?: number; label?: string;
}) {
  if (!elements.length) return null;
  const lo = Math.min(...elements.map((e) => e.value));
  const hi = Math.max(...elements.map((e) => e.value));
  const cols = 18, rows = Math.max(...elements.map((e) => e.period));
  // Cells are square, so one size serves both axes and the viewBox is
  // simply as tall as the number of periods.
  const cw = 100 / cols;
  const ink = (v: number) => 0.12 + ((v - lo) / (hi - lo || 1)) * 0.8;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 100 ${rows * cw}`} width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${elements.length} elements by group and period`}>
        {elements.map((e) => {
          const k = ink(e.value);
          const x = (e.group - 1) * cw, y = (e.period - 1) * cw;
          return (
            <g key={e.symbol}>
              <rect x={x + 0.25} y={y + 0.25} width={cw - 0.5} height={cw - 0.5}
                fill={TONE} fillOpacity={k} rx={0.5} />
              <text x={x + cw / 2} y={y + cw * 0.64} fontSize={2.7} textAnchor="middle"
                fill={k > 0.5 ? "var(--background)" : "var(--foreground)"}>{e.symbol}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{lo}</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, color-mix(in oklch, ${TONE} 12%, transparent), ${TONE})` }} />
        <span>{hi}{unit ? ` ${unit}` : ""}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">Position is group and period — the layout is the trend</p>
    </div>
  );
}

/* ---------------------------------------------------------- phase diagram */
/**
 * Pressure against temperature, with the three phase boundaries and the two
 * points that matter: the triple point and the critical point.
 *
 * Both are DERIVED from where the supplied boundaries end, never taken as
 * separate props — a diagram whose labelled triple point is not on the curves
 * is a drawing, not a diagram.
 */
export function PhaseDiagram({
  fusion, vaporisation, sublimation, height = 240, labels, label,
}: {
  /** each is a polyline in (temperature, pressure) data space */
  fusion: { t: number; p: number }[];
  vaporisation: { t: number; p: number }[];
  sublimation: { t: number; p: number }[];
  height?: number;
  labels?: { solid?: string; liquid?: string; gas?: string };
  label?: string;
}) {
  const all = [...fusion, ...vaporisation, ...sublimation];
  if (all.length < 3) return null;
  const tLo = Math.min(...all.map((d) => d.t)), tHi = Math.max(...all.map((d) => d.t));
  const pLo = Math.min(...all.map((d) => d.p)), pHi = Math.max(...all.map((d) => d.p));
  const x = (t: number) => ((t - tLo) / (tHi - tLo || 1)) * 100;
  const y = (p: number) => 100 - ((p - pLo) / (pHi - pLo || 1)) * 100;
  const pts = (a: { t: number; p: number }[]) => a.map((d) => `${x(d.t)},${y(d.p)}`).join(" ");
  const triple = vaporisation[0];
  const critical = vaporisation[vaporisation.length - 1];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="-2 -2 104 104" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? "phase diagram"}>
          <polyline points={pts(sublimation)} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <polyline points={pts(fusion)} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <polyline points={pts(vaporisation)} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* The markers are HTML, not <circle>: preserveAspectRatio="none" stretches
            the viewBox to fill the panel, and a circle inside it comes out an ellipse. */}
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x(triple.t)}%`, top: `${y(triple.p)}%`, background: TONE }} />
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${x(critical.t)}%`, top: `${y(critical.p)}%`, background: "var(--background)", borderColor: TONE }} />
        <span className="absolute text-[10px] font-medium" style={{ left: "8%", top: "20%" }}>{labels?.solid ?? "solid"}</span>
        <span className="absolute text-[10px] font-medium" style={{ left: "42%", top: "8%" }}>{labels?.liquid ?? "liquid"}</span>
        <span className="absolute text-[10px] font-medium" style={{ left: "64%", top: "74%" }}>{labels?.gas ?? "gas"}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-[10px] text-muted-foreground">
        <span>● triple point {triple.t}, {triple.p}</span>
        <span>○ critical point {critical.t}, {critical.p}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">Both points are read off the curves, not placed separately</p>
    </div>
  );
}

/* --------------------------------------------------------- titration curve */
/**
 * pH against volume added, with the equivalence point taken as the STEEPEST
 * part of the curve rather than a number somebody typed in.
 */
export function TitrationCurve({
  points, height = 230, label,
}: {
  points: { ml: number; ph: number }[]; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const maxMl = Math.max(...points.map((p) => p.ml));
  const x = (ml: number) => (ml / maxMl) * 100;
  const y = (ph: number) => 100 - (ph / 14) * 100;

  let steep = 1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = (points[i + 1].ph - points[i - 1].ph) / (points[i + 1].ml - points[i - 1].ml || 1);
    const best = (points[steep + 1].ph - points[steep - 1].ph) / (points[steep + 1].ml - points[steep - 1].ml || 1);
    if (d > best) steep = i;
  }
  const eq = points[steep];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `equivalence near pH ${eq.ph} at ${eq.ml} mL`}>
          {[2, 4, 6, 8, 10, 12].map((p) => (
            <line key={p} x1={0} y1={y(p)} x2={100} y2={y(p)} stroke={TONE} strokeWidth={1}
              strokeOpacity={0.15} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} y1={y(7)} x2={100} y2={y(7)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          <polyline points={points.map((p) => `${x(p.ml)},${y(p.ph)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <line x1={x(eq.ml)} y1={0} x2={x(eq.ml)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* HTML marker — a <circle> in a preserveAspectRatio="none" viewBox is an ellipse. */}
        <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${x(eq.ml)}%`, top: `${y(eq.ph)}%`, background: "var(--background)", borderColor: TONE }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 mL</span><span>{maxMl} mL</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Equivalence at the steepest point — {eq.ml} mL, pH {eq.ph} · dashed line is neutral
      </p>
    </div>
  );
}

/* ------------------------------------------------------ reaction coordinate */
/**
 * Energy along a reaction path. Activation energy and ΔE are both COMPUTED
 * from the drawn profile, so the arrows can never disagree with the curve.
 */
export function ReactionCoordinate({
  states, unit = "kJ/mol", height = 230, label,
}: {
  /** alternating minima and transition states, left to right */
  states: { label: string; energy: number; transition?: boolean }[];
  unit?: string; height?: number; label?: string;
}) {
  if (states.length < 2) return null;
  const lo = Math.min(...states.map((s) => s.energy));
  const hi = Math.max(...states.map((s) => s.energy));
  const pad = (hi - lo) * 0.18 || 1;
  const y = (e: number) => 100 - ((e - lo + pad) / (hi - lo + pad * 2)) * 100;
  const x = (i: number) => (i / (states.length - 1)) * 100;

  // A smooth path through the states, so a transition state reads as a hump.
  let d = `M ${x(0)},${y(states[0].energy)}`;
  for (let i = 1; i < states.length; i++) {
    const px = x(i - 1), cx = x(i);
    d += ` C ${px + (cx - px) * 0.45},${y(states[i - 1].energy)} ${cx - (cx - px) * 0.45},${y(states[i].energy)} ${cx},${y(states[i].energy)}`;
  }
  const peak = states.reduce((a, b) => (b.energy > a.energy ? b : a));
  const ea = peak.energy - states[0].energy;
  const dE = states[states.length - 1].energy - states[0].energy;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `activation ${ea} ${unit}, overall ${dE} ${unit}`}>
        <path d={d} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {states.map((s, i) => (
          <g key={s.label}>
            <line x1={x(i) - 4} y1={y(s.energy)} x2={x(i) + 4} y2={y(s.energy)}
              stroke={TONE} strokeWidth={s.transition ? 1 : 2.4} strokeDasharray={s.transition ? "3 2" : undefined}
              vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <line x1={x(0)} y1={y(states[0].energy)} x2={x(0)} y2={y(peak.energy)}
          stroke={TONE} strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
        <line x1={x(states.length - 1)} y1={y(states[0].energy)} x2={x(states.length - 1)} y2={y(states[states.length - 1].energy)}
          stroke={TONE} strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex">
        {states.map((s) => (
          <span key={s.label} className="flex-1 text-center text-[9px] text-muted-foreground">{s.label}</span>
        ))}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Activation {ea > 0 ? "+" : ""}{ea} {unit} · overall {dE > 0 ? "+" : ""}{dE} {unit} ({dE < 0 ? "exothermic" : "endothermic"})
      </p>
    </div>
  );
}

/* ------------------------------------------------------ absorption spectrum */
/** Intensity against wavelength, with the named peaks marked where they fall. */
export function AbsorptionSpectrum({
  points, peaks = [], height = 210, label,
}: {
  points: { nm: number; a: number }[]; peaks?: { nm: number; label: string }[];
  height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const lo = Math.min(...points.map((p) => p.nm)), hi = Math.max(...points.map((p) => p.nm));
  const max = Math.max(...points.map((p) => p.a)) * 1.1;
  const x = (nm: number) => ((nm - lo) / (hi - lo || 1)) * 100;
  const y = (a: number) => 100 - (a / max) * 100;
  const λmax = points.reduce((a, b) => (b.a > a.a ? b : a));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `strongest absorption at ${λmax.nm} nm`}>
        <polygon points={`${points.map((p) => `${x(p.nm)},${y(p.a)}`).join(" ")} 100,100 0,100`}
          fill={TONE} fillOpacity={0.14} />
        <polyline points={points.map((p) => `${x(p.nm)},${y(p.a)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {peaks.map((p) => (
          <line key={p.label} x1={x(p.nm)} y1={0} x2={x(p.nm)} y2={100}
            stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="relative mt-1 h-3.5">
        {peaks.map((p) => (
          <span key={p.label} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${Math.min(94, Math.max(6, x(p.nm)))}%` }}>{p.label}</span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{lo} nm</span><span>{hi} nm</span>
      </div>
      <p className="text-[10px] text-muted-foreground">λmax {λmax.nm} nm</p>
    </div>
  );
}

/* --------------------------------------------------------------- decay curve */
/**
 * Exponential decay with the half-lives marked.
 *
 * The half-life markers are DERIVED by halving from the starting value, so a
 * curve that does not actually halve at the stated interval shows it.
 */
export function DecayCurve({
  halfLife, span, unit = "years", start = 100, steps = 120, height = 220, label,
}: {
  halfLife: number; span: number; unit?: string; start?: number; steps?: number; height?: number; label?: string;
}) {
  if (halfLife <= 0 || span <= 0) return null;
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * span;
    return { t, v: start * Math.pow(0.5, t / halfLife) };
  });
  const x = (t: number) => (t / span) * 100;
  const y = (v: number) => 100 - (v / start) * 100;
  const halves: number[] = [];
  for (let n = 1; n * halfLife <= span; n++) halves.push(n);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `half-life ${halfLife} ${unit}`}>
        {halves.map((n) => (
          <g key={n}>
            <line x1={x(n * halfLife)} y1={y(start * Math.pow(0.5, n))} x2={x(n * halfLife)} y2={100}
              stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={y(start * Math.pow(0.5, n))} x2={x(n * halfLife)} y2={y(start * Math.pow(0.5, n))}
              stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <polygon points={`${pts.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} 100,100 0,100`} fill={TONE} fillOpacity={0.12} />
        <polyline points={pts.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-1 h-3.5">
        {halves.map((n) => (
          <span key={n} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${x(n * halfLife)}%` }}>{n * halfLife}</span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Half-life {halfLife} {unit} · {(start * Math.pow(0.5, span / halfLife)).toFixed(1)}% left after {span} {unit}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- shear and moment */
/**
 * Shear force and bending moment along a beam, both INTEGRATED from the loads.
 *
 * Two stacked panels sharing one axis, because the pair is how the beam is
 * read — moment peaks where shear crosses zero, and that only shows if the
 * axes line up.
 */
export function ShearMoment({
  length, loads, supports, height = 260, label,
}: {
  length: number;
  /** point loads, positive downward */ loads: { at: number; kn: number }[];
  supports: [number, number];
  height?: number; label?: string;
}) {
  if (length <= 0) return null;
  const [a, b] = supports;
  const total = loads.reduce((s, l) => s + l.kn, 0);
  // Reactions from moment balance about A, then vertical equilibrium.
  const rb = loads.reduce((s, l) => s + l.kn * (l.at - a), 0) / (b - a || 1);
  const ra = total - rb;

  const N = 200;
  const shear: number[] = [], moment: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * length;
    let v = 0, m = 0;
    if (x >= a) { v += ra; m += ra * (x - a); }
    if (x >= b) { v += rb; m += rb * (x - b); }
    for (const l of loads) if (x >= l.at) { v -= l.kn; m -= l.kn * (x - l.at); }
    shear.push(v); moment.push(m);
  }
  const vMax = Math.max(...shear.map(Math.abs)) || 1;
  const mMax = Math.max(...moment.map(Math.abs)) || 1;
  const px = (i: number) => (i / N) * 100;
  const mPeakIdx = moment.reduce((best, m, i) => (Math.abs(m) > Math.abs(moment[best]) ? i : best), 0);

  const panel = (vals: number[], scale: number, fill: boolean) => (
    <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height: height / 2 - 14 }}>
      <line x1={0} y1={50} x2={100} y2={50} stroke={TONE} strokeWidth={1} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      {fill ? (
        <polygon points={`0,50 ${vals.map((v, i) => `${px(i)},${50 - (v / scale) * 46}`).join(" ")} 100,50`}
          fill={TONE} fillOpacity={0.16} />
      ) : null}
      <polyline points={vals.map((v, i) => `${px(i)},${50 - (v / scale) * 46}`).join(" ")}
        fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );

  return (
    <div className="w-full" role="img" aria-label={label ?? `peak moment ${moment[mPeakIdx].toFixed(1)} kNm`}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span>Shear (kN)</span></div>
      {panel(shear, vMax, true)}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span>Moment (kNm)</span></div>
      {panel(moment, mMax, true)}
      <div className="relative mt-1 h-3">
        {supports.map((s, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${(s / length) * 100}%` }}>▲</span>
        ))}
        {loads.map((l, i) => (
          <span key={`l${i}`} className="absolute -translate-x-1/2 text-[10px] text-foreground" style={{ left: `${(l.at / length) * 100}%` }}>↓{l.kn}</span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Reactions {ra.toFixed(1)} and {rb.toFixed(1)} kN · peak moment {Math.abs(moment[mPeakIdx]).toFixed(1)} kNm at {((mPeakIdx / N) * length).toFixed(2)} m
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ harmonic series */
/** Partials of a fundamental, with amplitude, and the interval each one is. */
export function HarmonicSeries({
  fundamental, partials, height = 210, label,
}: {
  fundamental: number; partials: { n: number; amplitude: number }[]; height?: number; label?: string;
}) {
  if (!partials.length) return null;
  const maxN = Math.max(...partials.map((p) => p.n));
  const maxA = Math.max(...partials.map((p) => p.amplitude));
  // Nearest-semitone name for the ratio n:1, which is what a musician reads.
  const NAMES = ["unison", "min 2nd", "maj 2nd", "min 3rd", "maj 3rd", "4th", "tritone", "5th", "min 6th", "maj 6th", "min 7th", "maj 7th"];
  const interval = (n: number) => {
    const semis = Math.round(12 * Math.log2(n));
    const oct = Math.floor(semis / 12);
    const name = NAMES[((semis % 12) + 12) % 12];
    const octaves = `${oct} octave${oct > 1 ? "s" : ""}`;
    // A whole number of octaves is named as such — "unison + 1 octave" is a
    // true statement and not what anybody calls the second partial.
    if (name === "unison") return oct === 0 ? "unison" : octaves;
    return oct ? `${name} + ${octaves}` : name;
  };

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        {partials.map((p) => (
          <div key={p.n} className="absolute bottom-0" title={`${p.n} · ${fundamental * p.n} Hz`}
            style={{ left: `${((p.n - 1) / maxN) * 100}%`, width: "1.6%", height: `${(p.amplitude / maxA) * 100}%`, background: TONE }} />
        ))}
      </div>
      <div className="relative mt-1 h-3">
        {partials.filter((p) => p.n <= 8 || p.n % 2 === 0).map((p) => (
          <span key={p.n} className="absolute text-[9px] text-muted-foreground" style={{ left: `${((p.n - 1) / maxN) * 100}%` }}>{p.n}</span>
        ))}
      </div>
      <div className="mt-1 space-y-0.5">
        {partials.slice(0, 4).map((p) => (
          <p key={p.n} className="text-[10px] text-muted-foreground">
            {p.n} · {Math.round(fundamental * p.n)} Hz · {interval(p.n)}
          </p>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Fundamental {fundamental} Hz · the 7th partial is noticeably flat of any note on a keyboard
      </p>
    </div>
  );
}
