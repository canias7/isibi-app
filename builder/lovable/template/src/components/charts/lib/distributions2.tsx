/** A second batch of distribution charts. */

const TONE = "var(--foreground)";

const gauss = (u: number) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
export function density(values: number[], lo: number, hi: number, steps: number, bw?: number) {
  const n = values.length || 1;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
  const h = bw ?? 1.06 * sd * Math.pow(n, -1 / 5);
  return Array.from({ length: steps }, (_, i) => {
    const x = lo + ((hi - lo) * i) / (steps - 1);
    return values.reduce((s, v) => s + gauss((x - v) / h), 0) / (n * h);
  });
}
const q = (sorted: number[], p: number) => {
  const pos = (sorted.length - 1) * p, b = Math.floor(pos), r = pos - b;
  return sorted[b + 1] !== undefined ? sorted[b] + r * (sorted[b + 1] - sorted[b]) : sorted[b];
};

/* ---------------------------------------------------------------- raincloud */
/**
 * Half a violin, a box and the raw points, stacked.
 *
 * Each answers a different question — shape, summary, and every actual
 * observation — and the reason to combine them is that any one alone can hide
 * what the other two show.
 */
export function Raincloud({
  groups, height = 250, steps = 48, min, max, label,
}: {
  groups: { label: string; values: number[] }[];
  height?: number; steps?: number; min?: number; max?: number; label?: string;
}) {
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.values);
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const curves = groups.map((g) => density(g.values, lo, hi, steps));
  const peak = Math.max(...curves.flat()) || 1;
  const rowH = height / groups.length;
  const X = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Shape, summary and points for ${groups.length} groups`}>
      <div className="relative" style={{ height }}>
        {groups.map((g, gi) => {
          const s = [...g.values].sort((a, b) => a - b);
          const q1 = q(s, 0.25), med = q(s, 0.5), q3 = q(s, 0.75);
          const top = gi * rowH;
          const cloud = rowH * 0.5;
          let seed = gi * 977 + 13;
          const jitter = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed % 1000) / 1000; };
          return (
            <div key={g.label}>
              <svg viewBox={`0 0 100 ${cloud}`} preserveAspectRatio="none"
                className="absolute left-0 w-full" style={{ top, height: cloud }}>
                <polygon
                  points={`0,${cloud} ${curves[gi].map((v, k) => `${(k / (steps - 1)) * 100},${cloud - (v / peak) * cloud}`).join(" ")} 100,${cloud}`}
                  fill={TONE} fillOpacity={0.16} stroke={TONE} strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="absolute h-[3px] rounded-full"
                style={{ top: top + cloud + 4, left: `${X(q1)}%`, width: `${X(q3) - X(q1)}%`, background: TONE, opacity: 0.5 }} />
              <div className="absolute h-[9px] w-[2px]" style={{ top: top + cloud + 1, left: `${X(med)}%`, background: TONE }} />
              {g.values.map((v, i) => (
                <span key={i} className="absolute h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ left: `${X(v)}%`, top: top + cloud + 14 + jitter() * (rowH * 0.22), background: TONE, opacity: 0.4 }} />
              ))}
              <span className="absolute left-0 text-[10px] text-muted-foreground" style={{ top }}>{g.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- sina */
/** Points jittered in proportion to the local density — a violin made of dots. */
export function SinaPlot({
  groups, height = 240, min, max, label,
}: {
  groups: { label: string; values: number[] }[];
  height?: number; min?: number; max?: number; label?: string;
}) {
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.values);
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const slot = 100 / groups.length;
  const steps = 40;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${all.length} points shaped by density`}>
      <div className="relative" style={{ height }}>
        {groups.map((g, gi) => {
          const d = density(g.values, lo, hi, steps);
          const peak = Math.max(...d) || 1;
          const centre = gi * slot + slot / 2;
          let seed = gi * 613 + 7;
          const jit = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed % 1000) / 1000 - 0.5; };
          return g.values.map((v, i) => {
            const t = (v - lo) / (hi - lo || 1);
            const k = Math.min(steps - 1, Math.round(t * (steps - 1)));
            // Spread is the LOCAL density: wide where values pile up, narrow
            // in the tails. Uniform jitter would draw a rectangle.
            const spread = (d[k] / peak) * slot * 0.4;
            return (
              <span key={`${gi}-${i}`} className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${centre + jit() * spread * 2}%`, top: `${100 - t * 96 - 2}%`, background: TONE, opacity: 0.5 }} />
            );
          });
        })}
      </div>
      <div className="flex">
        {groups.map((g) => (
          <div key={g.label} className="truncate text-center text-[10px] text-muted-foreground" style={{ width: `${slot}%` }}>{g.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- letter value */
/**
 * Nested boxes at successive quantile depths — a box plot that keeps
 * describing the tails instead of throwing them away as "outliers".
 *
 * Useful precisely when there are enough observations that a box plot's
 * whiskers stop meaning anything, which is most real datasets.
 */
export function LetterValuePlot({
  groups, depths = 4, height = 230, min, max, label,
}: {
  groups: { label: string; values: number[] }[];
  depths?: number; height?: number; min?: number; max?: number; label?: string;
}) {
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.values);
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const slot = 100 / groups.length;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Quantile depths across ${groups.length} groups`}>
      <div className="relative" style={{ height }}>
        {groups.map((g, gi) => {
          const s = [...g.values].sort((a, b) => a - b);
          const centre = gi * slot + slot / 2;
          const boxes = Array.from({ length: depths }, (_, d) => {
            const p = 0.5 / Math.pow(2, d);
            return { lo: q(s, p), hi: q(s, 1 - p), w: slot * (0.5 - d * 0.09) };
          });
          return (
            <div key={g.label}>
              {boxes.map((b, d) => (
                <div key={d} className="absolute rounded-[2px] border"
                  style={{
                    left: `${centre - b.w / 2}%`, width: `${b.w}%`,
                    top: `${Y(b.hi)}%`, height: `${Math.max(0.5, Y(b.lo) - Y(b.hi))}%`,
                    background: `color-mix(in oklch, var(--foreground) ${Math.round(60 - d * 13)}%, transparent)`,
                    borderColor: "var(--background)",
                  }} title={`${g.label}: ${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`} />
              ))}
              <div className="absolute h-[2px]" style={{ left: `${centre - slot * 0.25}%`, width: `${slot * 0.5}%`, top: `${Y(q(s, 0.5))}%`, background: "var(--background)" }} />
            </div>
          );
        })}
      </div>
      <div className="flex">
        {groups.map((g) => (
          <div key={g.label} className="truncate text-center text-[10px] text-muted-foreground" style={{ width: `${slot}%` }}>{g.label}</div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------- back-to-back histogram */
/** Two distributions mirrored about a shared axis. */
export function BackToBackHistogram({
  left, right, bins = 14, height = 240, labels = ["Left", "Right"], label,
}: {
  left: number[]; right: number[]; bins?: number; height?: number;
  labels?: [string, string] | string[]; label?: string;
}) {
  if (!left.length || !right.length) return null;
  const all = [...left, ...right];
  const lo = Math.min(...all), hi = Math.max(...all);
  const w = (hi - lo) / bins || 1;
  const count = (vs: number[]) => {
    const c = Array(bins).fill(0) as number[];
    for (const v of vs) c[v === hi ? bins - 1 : Math.floor((v - lo) / w)]++;
    return c;
  };
  const L = count(left), R = count(right);
  const peak = Math.max(...L, ...R) || 1;
  const rowH = height / bins;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${labels[0]} against ${labels[1]}`}>
      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{labels[0]}</span><span>{labels[1]}</span>
      </div>
      <div className="relative" style={{ height }}>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        {Array.from({ length: bins }, (_, i) => {
          const r = bins - 1 - i;
          return (
            <div key={i}>
              <div className="absolute rounded-l-[2px]"
                style={{ top: i * rowH + 1, height: rowH - 2, right: "50%", width: `${(L[r] / peak) * 48}%`, background: TONE, opacity: 0.8 }} />
              <div className="absolute rounded-r-[2px]"
                style={{ top: i * rowH + 1, height: rowH - 2, left: "50%", width: `${(R[r] / peak) * 48}%`, background: TONE, opacity: 0.35, border: `1px solid ${TONE}` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{hi.toFixed(0)} at top</span><span>{lo.toFixed(0)} at bottom</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ogive */
/** A cumulative histogram — running total across the bins. */
export function Ogive({
  values, bins = 16, height = 210, format = (n: number) => String(Math.round(n)), label,
}: {
  values: number[]; bins?: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0) as number[];
  for (const v of values) counts[v === hi ? bins - 1 : Math.floor((v - lo) / w)]++;
  let run = 0;
  const cum = counts.map((c) => (run += c));
  const total = values.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Cumulative counts across ${bins} bins`}>
      <div className="relative flex w-full items-end gap-[2px]" style={{ height }}>
        {cum.map((c, i) => (
          <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${(c / total) * 100}%`, background: TONE, opacity: 0.25 + (c / total) * 0.6 }}
            title={`Up to ${format(lo + (i + 1) * w)}: ${c} (${Math.round((c / total) * 100)}%)`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(lo)}</span><span>{format(hi)}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- density overlay */
/** Two densities on one axis, one filled and one outlined. */
export function DensityOverlay({
  series, height = 220, steps = 64, label,
}: {
  series: { label: string; values: number[] }[]; height?: number; steps?: number; label?: string;
}) {
  if (!series.length) return null;
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(...all), hi = Math.max(...all);
  const curves = series.map((s) => density(s.values, lo, hi, steps));
  const peak = Math.max(...curves.flat()) || 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${series.length} distributions overlaid`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {curves.map((c, i) => (
            <polygon key={series[i].label}
              points={`0,100 ${c.map((v, k) => `${(k / (steps - 1)) * 100},${100 - (v / peak) * 96}`).join(" ")} 100,100`}
              fill={TONE} fillOpacity={i === 0 ? 0.18 : 0}
              stroke={TONE} strokeOpacity={0.7} strokeWidth={1.4}
              strokeDasharray={i === 0 ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
        {series.map((s, i) => <span key={s.label}>{i === 0 ? "▬ " : "-- "}{s.label}</span>)}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Lorenz curve */
/**
 * Cumulative share of the total against cumulative share of the population,
 * with the Gini coefficient computed from the gap to equality.
 *
 * This is the honest version of "our top 20% of customers are X% of revenue" —
 * the whole curve, not one cherry-picked point on it.
 */
export function LorenzCurve({
  values, size = 250, label,
}: {
  values: number[]; size?: number; label?: string;
}) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const total = s.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  const pts = [{ p: 0, v: 0 }, ...s.map((v, i) => ({ p: (i + 1) / s.length, v: (run += v) / total }))];
  // Gini as twice the area between the curve and the diagonal.
  let area = 0;
  for (let i = 1; i < pts.length; i++) area += ((pts[i].p - pts[i - 1].p) * (pts[i].v + pts[i - 1].v)) / 2;
  const gini = 1 - 2 * area;
  const top20 = 1 - (pts.find((x) => x.p >= 0.8)?.v ?? 0);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `Gini ${gini.toFixed(2)}`}>
        <line x1={0} y1={100} x2={100} y2={0} stroke="var(--border)" strokeDasharray="3 3" />
        <polygon points={`0,100 ${pts.map((x) => `${x.p * 100},${100 - x.v * 100}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.1} />
        <polyline points={pts.map((x) => `${x.p * 100},${100 - x.v * 100}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Gini {gini.toFixed(2)} · the top 20% account for {Math.round(top20 * 100)}%
      </p>
    </div>
  );
}

/* --------------------------------------------------------- rank-size plot */
/** Value against rank on log axes — a straight line means a power law. */
export function RankSizePlot({
  values, size = 250, label,
}: {
  values: number[]; size?: number; label?: string;
}) {
  if (values.length < 2) return null;
  const s = [...values].sort((a, b) => b - a).filter((v) => v > 0);
  const X = (r: number) => (Math.log(r) / Math.log(s.length)) * 96 + 2;
  const lgLo = Math.log(s[s.length - 1]), lgHi = Math.log(s[0]);
  const Y = (v: number) => 98 - ((Math.log(v) - lgLo) / (lgHi - lgLo || 1)) * 96;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${s.length} items by rank on log axes`}>
        <line x1={X(1)} y1={Y(s[0])} x2={X(s.length)} y2={Y(s[s.length - 1])} stroke="var(--border)" strokeDasharray="3 3" />
        {s.map((v, i) => <circle key={i} cx={X(i + 1)} cy={Y(v)} r={1.7} fill={TONE} fillOpacity={0.75} />)}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Both axes log · a straight line is a power law</p>
    </div>
  );
}

/* ------------------------------------------------------- pyramid histogram */
/** A single distribution as a centred pyramid — symmetry made obvious. */
export function PyramidHistogram({
  values, bins = 16, height = 240, format = (n: number) => String(Math.round(n)), label,
}: {
  values: number[]; bins?: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0) as number[];
  for (const v of values) counts[v === hi ? bins - 1 : Math.floor((v - lo) / w)]++;
  const peak = Math.max(...counts) || 1;
  const rowH = height / bins;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${values.length} values, centred`}>
      <div className="relative" style={{ height }}>
        {counts.map((c, i) => {
          const r = bins - 1 - i;
          const wpc = (counts[r] / peak) * 96;
          return (
            <div key={i} className="absolute -translate-x-1/2 rounded-[2px]"
              style={{ left: "50%", width: `${wpc}%`, top: i * rowH + 1, height: rowH - 2, background: TONE, opacity: 0.8 }}
              title={`${format(lo + r * w)}–${format(lo + (r + 1) * w)}: ${c}`} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(hi)} at top</span><span>{format(lo)} at bottom</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- joint plot */
/**
 * A scatter with each variable's own histogram on its margin.
 *
 * The margins are the point: a scatter can look evenly spread while one of the
 * two variables is badly skewed, and you cannot see that from the cloud alone.
 */
export function JointPlot({
  points, size = 260, bins = 18, label,
}: {
  points: { x: number; y: number }[]; size?: number; bins?: number; label?: string;
}) {
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const yLo = Math.min(...ys), yHi = Math.max(...ys);
  const hist = (vs: number[], lo: number, hi: number) => {
    const w = (hi - lo) / bins || 1;
    const c = Array(bins).fill(0) as number[];
    for (const v of vs) c[v === hi ? bins - 1 : Math.floor((v - lo) / w)]++;
    return c;
  };
  const hx = hist(xs, xLo, xHi), hy = hist(ys, yLo, yHi);
  const px = Math.max(...hx) || 1, py = Math.max(...hy) || 1;
  const margin = 34;

  return (
    <div className="w-full" style={{ maxWidth: size + margin }}
      role="img" aria-label={label ?? `${points.length} points with marginal distributions`}>
      <div className="flex gap-1" style={{ height: margin }}>
        <div className="flex items-end gap-[1px]" style={{ width: size }}>
          {hx.map((c, i) => <div key={i} className="flex-1" style={{ height: `${(c / px) * 100}%`, background: TONE, opacity: 0.5 }} />)}
        </div>
        <div style={{ width: margin }} />
      </div>
      <div className="mt-1 flex gap-1">
        <div className="relative rounded-[2px] border border-border" style={{ width: size, height: size }}>
          {points.map((p, i) => (
            <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${((p.x - xLo) / (xHi - xLo || 1)) * 92 + 4}%`,
                top: `${(1 - (p.y - yLo) / (yHi - yLo || 1)) * 92 + 4}%`,
                background: TONE, opacity: 0.5,
              }} />
          ))}
        </div>
        <div className="flex flex-col-reverse gap-[1px]" style={{ width: margin, height: size }}>
          {hy.map((c, i) => <div key={i} className="flex-1" style={{ width: `${(c / py) * 100}%`, background: TONE, opacity: 0.5 }} />)}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- mirror density */
/** Two densities back to back — the smooth cousin of the pyramid. */
export function MirrorDensity({
  top, bottom, height = 230, steps = 64, labels = ["Above", "Below"], label,
}: {
  top: number[]; bottom: number[]; height?: number; steps?: number;
  labels?: [string, string] | string[]; label?: string;
}) {
  if (!top.length || !bottom.length) return null;
  const all = [...top, ...bottom];
  const lo = Math.min(...all), hi = Math.max(...all);
  const a = density(top, lo, hi, steps), b = density(bottom, lo, hi, steps);
  const peak = Math.max(...a, ...b) || 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${labels[0]} against ${labels[1]}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,50 ${a.map((v, k) => `${(k / (steps - 1)) * 100},${50 - (v / peak) * 48}`).join(" ")} 100,50`}
            fill={TONE} fillOpacity={0.24} stroke={TONE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <polygon points={`0,50 ${b.map((v, k) => `${(k / (steps - 1)) * 100},${50 + (v / peak) * 48}`).join(" ")} 100,50`}
            fill={TONE} fillOpacity={0.08} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={50} y2={50} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{labels[0]} above</span><span>{labels[1]} below</span>
      </div>
    </div>
  );
}
