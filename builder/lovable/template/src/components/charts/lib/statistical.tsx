/** Statistical charts. Deterministic throughout — no Math.random. */

const TONE = "var(--foreground)";

export function rnd(seed = 1) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 100000) / 100000; };
}

/* -------------------------------------------------------- survival curve */
/**
 * Kaplan-Meier: the share still "alive" over time, as a step function.
 *
 * STEPS, not a smooth line — the estimate only changes at an event, and
 * interpolating between them claims to know something about the gap that the
 * method explicitly does not.
 */
export function SurvivalCurve({
  cohorts, height = 220, xLabel = "Months", label,
}: {
  cohorts: { label: string; points: { t: number; surviving: number }[] }[];
  height?: number; xLabel?: string; label?: string;
}) {
  if (!cohorts.length) return null;
  const tMax = Math.max(...cohorts.flatMap((c) => c.points.map((p) => p.t))) || 1;
  const X = (t: number) => (t / tMax) * 100;
  const Y = (s: number) => 100 - s * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Survival across ${cohorts.length} cohorts`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {cohorts.map((c, ci) => {
            const d: string[] = [];
            c.points.forEach((p, i) => {
              if (i === 0) d.push(`M ${X(p.t)} ${Y(p.surviving)}`);
              else {
                d.push(`L ${X(p.t)} ${Y(c.points[i - 1].surviving)}`);
                d.push(`L ${X(p.t)} ${Y(p.surviving)}`);
              }
            });
            return (
              <path key={c.label} d={d.join(" ")} fill="none" stroke={TONE}
                strokeWidth={ci === 0 ? 2 : 1.2} strokeOpacity={ci === 0 ? 1 : 0.45}
                strokeDasharray={ci === 0 ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 {xLabel.toLowerCase()}</span>
        {cohorts.map((c) => <span key={c.label}>{c.label}</span>)}
        <span>{tMax} {xLabel.toLowerCase()}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ forest plot */
/** Effect sizes with confidence intervals, and a line of no effect. */
export function ForestPlot({
  rows, centre = 0, rowHeight = 30, format = (n: number) => n.toFixed(2), label,
}: {
  rows: { label: string; estimate: number; low: number; high: number; weight?: number }[];
  centre?: number; rowHeight?: number; format?: (n: number) => string; label?: string;
}) {
  if (!rows.length) return null;
  const lo = Math.min(...rows.map((r) => r.low), centre);
  const hi = Math.max(...rows.map((r) => r.high), centre);
  const pad = (hi - lo) * 0.08 || 1;
  const X = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;
  const maxW = Math.max(1, ...rows.map((r) => r.weight ?? 1));

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} estimates with intervals`}>
      <div className="relative" style={{ height: rows.length * rowHeight }}>
        <div className="absolute top-0 bottom-0 border-l border-dashed border-border" style={{ left: `${X(centre)}%` }} />
        {rows.map((r, i) => {
          // Box AREA carries the study weight; the interval carries the
          // uncertainty. Two encodings, two different facts.
          const s = 6 + ((r.weight ?? 1) / maxW) * 8;
          return (
            <div key={r.label}>
              <div className="absolute h-px" style={{ top: i * rowHeight + rowHeight / 2, left: `${X(r.low)}%`, width: `${X(r.high) - X(r.low)}%`, background: TONE }} />
              {[r.low, r.high].map((e) => (
                <div key={e} className="absolute w-px" style={{ top: i * rowHeight + rowHeight / 2 - 4, height: 8, left: `${X(e)}%`, background: TONE }} />
              ))}
              <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[1px]"
                style={{ top: i * rowHeight + rowHeight / 2, left: `${X(r.estimate)}%`, width: s, height: s, background: TONE }}
                title={`${r.label}: ${format(r.estimate)} (${format(r.low)}–${format(r.high)})`} />
              <span className="absolute left-0 -translate-y-1/2 bg-background pr-1 text-[10px] text-muted-foreground"
                style={{ top: i * rowHeight + 7 }}>{r.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(lo)}</span><span>no effect</span><span>{format(hi)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ funnel plot */
/**
 * Effect against precision, inside triangular pseudo-confidence limits.
 *
 * Nothing to do with a conversion funnel — this one detects publication bias.
 * A gap in one lower corner is the signal.
 */
export function FunnelPlot({
  points, centre, size = 260, label,
}: {
  points: { label?: string; effect: number; precision: number }[];
  centre?: number; size?: number; label?: string;
}) {
  if (!points.length) return null;
  const mid = centre ?? points.reduce((s, p) => s + p.effect, 0) / points.length;
  const spread = Math.max(...points.map((p) => Math.abs(p.effect - mid))) * 1.4 || 1;
  const pMax = Math.max(...points.map((p) => p.precision)) || 1;
  const X = (e: number) => ((e - mid) / spread) * 45 + 50;
  const Y = (p: number) => 96 - (p / pMax) * 88;

  return (
    <svg viewBox={`0 0 100 100`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${points.length} studies against precision`}>
      <line x1={50} y1={4} x2={50} y2={96} stroke="var(--border)" strokeDasharray="3 3" />
      <path d={`M 50 ${Y(pMax)} L ${X(mid - spread)} 96 L 50 96 Z`} fill={TONE} fillOpacity={0.05} />
      <path d={`M 50 ${Y(pMax)} L ${X(mid + spread)} 96 L 50 96 Z`} fill={TONE} fillOpacity={0.05} />
      <line x1={50} y1={Y(pMax)} x2={X(mid - spread)} y2={96} stroke="var(--border)" />
      <line x1={50} y1={Y(pMax)} x2={X(mid + spread)} y2={96} stroke="var(--border)" />
      {points.map((p, i) => (
        <circle key={i} cx={X(p.effect)} cy={Y(p.precision)} r={1.8} fill={TONE} fillOpacity={0.7}>
          <title>{p.label ?? `${p.effect}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------- bland-altman */
/** Difference against mean, with limits of agreement — do two measures agree? */
export function BlandAltman({
  pairs, height = 220, format = (n: number) => n.toFixed(1), label,
}: {
  pairs: { a: number; b: number }[]; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!pairs.length) return null;
  const pts = pairs.map((p) => ({ mean: (p.a + p.b) / 2, diff: p.a - p.b }));
  const bias = pts.reduce((s, p) => s + p.diff, 0) / pts.length;
  const sd = Math.sqrt(pts.reduce((s, p) => s + (p.diff - bias) ** 2, 0) / pts.length) || 1;
  const upper = bias + 1.96 * sd;
  const lower = bias - 1.96 * sd;

  const xs = pts.map((p) => p.mean);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const yLo = Math.min(lower, ...pts.map((p) => p.diff));
  const yHi = Math.max(upper, ...pts.map((p) => p.diff));
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 100;
  const Y = (v: number) => 100 - ((v - yLo) / (yHi - yLo || 1)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Agreement across ${pairs.length} pairs`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[{ v: upper, d: "3 3" }, { v: bias, d: "" }, { v: lower, d: "3 3" }].map((l, i) => (
            <line key={i} x1={0} x2={100} y1={Y(l.v)} y2={Y(l.v)} stroke={TONE}
              strokeOpacity={l.d ? 0.4 : 0.7} strokeDasharray={l.d || undefined} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {pts.map((p, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${X(p.mean)}%`, top: `${Y(p.diff)}%`, background: TONE, opacity: 0.6 }} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Bias {format(bias)} · limits {format(lower)} to {format(upper)}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- residual plot */
/** Residuals against fitted values. A pattern means the model is missing something. */
export function ResidualPlot({
  points, height = 200, label,
}: {
  points: { fitted: number; residual: number }[]; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const xs = points.map((p) => p.fitted), ys = points.map((p) => p.residual);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const bound = Math.max(...ys.map(Math.abs)) || 1;
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 100;
  const Y = (v: number) => 50 - (v / bound) * 46;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${points.length} residuals`}>
      <div className="absolute top-1/2 right-0 left-0 border-t border-border" />
      {points.map((p, i) => (
        <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${X(p.fitted)}%`, top: `${Y(p.residual)}%`, background: TONE, opacity: 0.6 }} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- ACF/lag */
/** Autocorrelation at each lag, with a significance band. */
export function Correlogram({
  values, lags = 16, height = 190, label,
}: {
  values: number[]; lags?: number; height?: number; label?: string;
}) {
  if (values.length < 3) return null;
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const denom = values.reduce((s, v) => s + (v - mean) ** 2, 0) || 1;
  const acf = Array.from({ length: lags + 1 }, (_, k) => {
    let num = 0;
    for (let i = 0; i + k < n; i++) num += (values[i] - mean) * (values[i + k] - mean);
    return num / denom;
  });
  // 95% band under the null of white noise.
  const band = 1.96 / Math.sqrt(n);
  const slot = 100 / acf.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Autocorrelation to lag ${lags}`}>
      <div className="relative" style={{ height }}>
        <div className="absolute top-1/2 right-0 left-0 border-t border-border" />
        <div className="absolute right-0 left-0 border-t border-dashed border-border" style={{ top: `${50 - band * 46}%` }} />
        <div className="absolute right-0 left-0 border-t border-dashed border-border" style={{ top: `${50 + band * 46}%` }} />
        {acf.map((v, k) => (
          <div key={k} className="absolute w-[2px] -translate-x-1/2"
            style={{
              left: `${k * slot + slot / 2}%`,
              top: v >= 0 ? `${50 - v * 46}%` : "50%",
              height: `${Math.abs(v) * 46}%`,
              background: TONE, opacity: Math.abs(v) > band ? 1 : 0.35,
            }} title={`Lag ${k}: ${v.toFixed(2)}`} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Dashed lines are the 95% band — bars beyond them are real</p>
    </div>
  );
}

export function LagPlot({ values, lag = 1, size = 230, label }: { values: number[]; lag?: number; size?: number; label?: string }) {
  if (values.length <= lag) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const P = (v: number) => ((v - lo) / (hi - lo || 1)) * 92 + 4;
  return (
    <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `Each value against the one ${lag} step before`}>
      <line x1={4} y1={96} x2={96} y2={4} stroke="var(--border)" strokeDasharray="3 3" />
      {values.slice(lag).map((v, i) => (
        <circle key={i} cx={P(values[i])} cy={100 - P(v)} r={1.6} fill={TONE} fillOpacity={0.65} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------- regression / smoothing */
/** Least-squares fit with a confidence band around it. */
export function RegressionBand({
  points, height = 220, label,
}: {
  points: { x: number; y: number }[]; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0) || 1;
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  const intercept = my - slope * mx;
  const resid = points.map((p) => p.y - (intercept + slope * p.x));
  const se = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2));

  const xs = points.map((p) => p.x);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const fit = (x: number) => intercept + slope * x;
  const halfWidth = (x: number) => 1.96 * se * Math.sqrt(1 / n + (x - mx) ** 2 / sxx);
  const steps = Array.from({ length: 24 }, (_, i) => xLo + ((xHi - xLo) * i) / 23);
  const ys = points.map((p) => p.y);
  const yLo = Math.min(...ys, ...steps.map((x) => fit(x) - halfWidth(x)));
  const yHi = Math.max(...ys, ...steps.map((x) => fit(x) + halfWidth(x)));
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 100;
  const Y = (v: number) => 100 - ((v - yLo) / (yHi - yLo || 1)) * 100;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `Fit through ${n} points`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polygon
          points={[...steps.map((x) => `${X(x)},${Y(fit(x) + halfWidth(x))}`), ...steps.map((x) => `${X(x)},${Y(fit(x) - halfWidth(x))}`).reverse()].join(" ")}
          fill={TONE} fillOpacity={0.12} />
        <line x1={X(xLo)} y1={Y(fit(xLo))} x2={X(xHi)} y2={Y(fit(xHi))} stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      {points.map((p, i) => (
        <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${X(p.x)}%`, top: `${Y(p.y)}%`, background: TONE, opacity: 0.6 }} />
      ))}
    </div>
  );
}

/** LOESS-ish local smoothing — a trend that does not assume a straight line. */
export function LoessPlot({
  points, span = 0.4, height = 220, label,
}: {
  points: { x: number; y: number }[]; span?: number; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const xs = sorted.map((p) => p.x), ys = sorted.map((p) => p.y);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const yLo = Math.min(...ys), yHi = Math.max(...ys);
  const bw = (xHi - xLo) * span || 1;
  const smooth = Array.from({ length: 40 }, (_, i) => {
    const x = xLo + ((xHi - xLo) * i) / 39;
    let wsum = 0, vsum = 0;
    for (const p of sorted) {
      const u = Math.abs(p.x - x) / bw;
      if (u >= 1) continue;
      const w = (1 - u ** 3) ** 3; // tricube
      wsum += w; vsum += w * p.y;
    }
    return { x, y: wsum ? vsum / wsum : 0 };
  }).filter((p) => p.y !== 0);
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 100;
  const Y = (v: number) => 100 - ((v - yLo) / (yHi - yLo || 1)) * 100;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `Local trend through ${points.length} points`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polyline points={smooth.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {sorted.map((p, i) => (
        <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${X(p.x)}%`, top: `${Y(p.y)}%`, background: TONE, opacity: 0.4 }} />
      ))}
    </div>
  );
}

/** Binned scatter — the mean of y within each x bin. */
export function BinScatter({
  points, bins = 12, height = 210, label,
}: {
  points: { x: number; y: number }[]; bins?: number; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const w = (xHi - xLo) / bins || 1;
  const cells = Array.from({ length: bins }, () => [] as number[]);
  for (const p of points) {
    const i = p.x === xHi ? bins - 1 : Math.floor((p.x - xLo) / w);
    if (cells[i]) cells[i].push(p.y);
  }
  const means = cells.map((c) => (c.length ? c.reduce((s, v) => s + v, 0) / c.length : null));
  const valid = means.filter((m): m is number => m !== null);
  const yLo = Math.min(...valid), yHi = Math.max(...valid);
  const Y = (v: number) => 100 - ((v - yLo) / (yHi - yLo || 1)) * 92 - 4;

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${points.length} points in ${bins} bins`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polyline points={means.map((m, i) => (m === null ? null : `${(i + 0.5) * (100 / bins)},${Y(m)}`)).filter(Boolean).join(" ")}
          fill="none" stroke={TONE} strokeOpacity={0.4} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      </svg>
      {means.map((m, i) => m === null ? null : (
        <span key={i} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${(i + 0.5) * (100 / bins)}%`, top: `${Y(m)}%`, background: TONE }}
          title={`Bin ${i + 1}: ${m.toFixed(1)} (${cells[i].length} points)`} />
      ))}
    </div>
  );
}

/** A rug: one tick per observation along an axis. Usually sits under another chart. */
export function RugPlot({ values, height = 44, label }: { values: number[]; height?: number; label?: string }) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${values.length} observations`}>
      <div className="absolute right-0 bottom-0 left-0 border-t border-border" />
      {values.map((v, i) => (
        <span key={i} className="absolute bottom-0 w-px" style={{ left: `${((v - lo) / (hi - lo || 1)) * 100}%`, height: height * 0.55, background: TONE, opacity: 0.4 }} />
      ))}
    </div>
  );
}

/** Wilkinson dot histogram — one dot per observation, stacked into bins. */
export function DotHistogram({
  values, bins = 24, height = 200, label,
}: {
  values: number[]; bins?: number; height?: number; label?: string;
}) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0) as number[];
  const placed = values.map((v) => {
    const i = v === hi ? bins - 1 : Math.floor((v - lo) / w);
    return { i, k: counts[i]++ };
  });
  const tallest = Math.max(...counts) || 1;
  const dot = Math.min(height / tallest, 100 / bins * 3);

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `${values.length} observations, one dot each`}>
      {placed.map((p, i) => (
        <span key={i} className="absolute rounded-full"
          style={{
            left: `${(p.i + 0.5) * (100 / bins)}%`, bottom: p.k * dot,
            width: dot * 0.8, height: dot * 0.8, marginLeft: -(dot * 0.4),
            background: TONE, opacity: 0.75,
          }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- text */
/** Sentiment over time as a diverging area about zero. */
export function SentimentTimeline({
  points, height = 200, label,
}: {
  points: { label: string; score: number }[]; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const bound = Math.max(...points.map((p) => Math.abs(p.score))) || 1;
  const X = (i: number) => (i / (points.length - 1 || 1)) * 100;
  const Y = (v: number) => 50 - (v / bound) * 46;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Sentiment across ${points.length} periods`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,50 ${points.map((p, i) => `${X(i)},${Y(p.score)}`).join(" ")} 100,50`}
            fill={TONE} fillOpacity={0.16} />
          <polyline points={points.map((p, i) => `${X(i)},${Y(p.score)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={50} y2={50} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0].label}</span>
        <span>positive above the line</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/** Terms ranked by frequency, with the count spelled out. */
export function NgramLadder({
  terms, max = 12, format = (n: number) => n.toLocaleString(), label,
}: {
  terms: { text: string; value: number }[]; max?: number; format?: (n: number) => string; label?: string;
}) {
  const rows = [...terms].sort((a, b) => b.value - a.value).slice(0, max);
  if (!rows.length) return null;
  const hi = rows[0].value || 1;
  return (
    <div className="w-full space-y-1" role="img" aria-label={label ?? `Top ${rows.length} terms`}>
      {rows.map((t) => (
        <div key={t.text} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-right text-[11px]">{t.text}</span>
          <div className="h-3 flex-1 rounded-[2px] bg-muted">
            <div className="h-full rounded-[2px]" style={{ width: `${(t.value / hi) * 100}%`, background: TONE }} />
          </div>
          <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{format(t.value)}</span>
        </div>
      ))}
    </div>
  );
}
