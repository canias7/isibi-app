/** Multivariate projections and monitoring statistics. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------ andrews curves */
/**
 * Each record as a Fourier curve: f(t) = x₁/√2 + x₂ sin t + x₃ cos t + …
 *
 * Records that are alike trace alike, so groups appear as bands — the point
 * being that this preserves distances, which a bar-per-column view does not.
 */
export function AndrewsCurves({
  rows, height = 230, steps = 72, label,
}: {
  rows: { values: number[]; group?: number }[]; height?: number; steps?: number; label?: string;
}) {
  if (!rows.length) return null;
  // Standardise each dimension first, or the largest-unit column swamps the curve.
  const dims = rows[0].values.length;
  const mean = Array.from({ length: dims }, (_, d) => rows.reduce((s, r) => s + r.values[d], 0) / rows.length);
  const sd = Array.from({ length: dims }, (_, d) =>
    Math.sqrt(rows.reduce((s, r) => s + (r.values[d] - mean[d]) ** 2, 0) / rows.length) || 1);
  const f = (z: number[], t: number) => {
    let v = z[0] / Math.SQRT2;
    for (let d = 1; d < z.length; d++) {
      const k = Math.ceil(d / 2);
      v += z[d] * (d % 2 ? Math.sin(k * t) : Math.cos(k * t));
    }
    return v;
  };
  const curves = rows.map((r) => {
    const z = r.values.map((v, d) => (v - mean[d]) / sd[d]);
    return Array.from({ length: steps + 1 }, (_, i) => f(z, -Math.PI + (i / steps) * Math.PI * 2));
  });
  const all = curves.flat();
  const lo = Math.min(...all), hi = Math.max(...all);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} records as curves`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {curves.map((c, i) => (
            <polyline key={i}
              points={c.map((v, k) => `${(k / steps) * 100},${100 - ((v - lo) / (hi - lo || 1)) * 96 - 2}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={rows[i].group === 1 ? 1.4 : 0.8}
              strokeOpacity={rows[i].group === 1 ? 0.75 : 0.3}
              strokeDasharray={rows[i].group === 1 ? undefined : undefined} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Similar records trace similar curves — the heavy band is one group</p>
    </div>
  );
}

/* ----------------------------------------------------------------- radviz */
/** Dimensional anchors on a ring; each record sits at its weighted pull. */
export function Radviz({
  anchors, rows, size = 260, label,
}: {
  anchors: string[]; rows: { values: number[]; label?: string }[]; size?: number; label?: string;
}) {
  if (!anchors.length || !rows.length) return null;
  const pos = anchors.map((_, i) => {
    const a = (i / anchors.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 40, y: 50 + Math.sin(a) * 40 };
  });
  // Normalise per dimension to 0-1 so every anchor pulls on the same scale.
  const dims = anchors.length;
  const lo = Array.from({ length: dims }, (_, d) => Math.min(...rows.map((r) => r.values[d])));
  const hi = Array.from({ length: dims }, (_, d) => Math.max(...rows.map((r) => r.values[d])));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${rows.length} records against ${anchors.length} anchors`}>
        <circle cx={50} cy={50} r={40} fill="none" stroke="var(--border)" />
        {pos.map((p, i) => (
          <g key={anchors[i]}>
            <circle cx={p.x} cy={p.y} r={1.8} fill={TONE} />
            <text x={50 + (p.x - 50) * 1.16} y={50 + (p.y - 50) * 1.16} textAnchor="middle" dominantBaseline="middle"
              fontSize={6} className="fill-muted-foreground">{anchors[i]}</text>
          </g>
        ))}
        {rows.map((r, ri) => {
          const w = r.values.map((v, d) => (v - lo[d]) / (hi[d] - lo[d] || 1));
          const sum = w.reduce((s, v) => s + v, 0) || 1;
          const x = w.reduce((s, v, d) => s + v * pos[d].x, 0) / sum;
          const y = w.reduce((s, v, d) => s + v * pos[d].y, 0) / sum;
          return <circle key={ri} cx={x} cy={y} r={1.6} fill={TONE} fillOpacity={0.55}>{r.label ? <title>{r.label}</title> : null}</circle>;
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">A point near an anchor is dominated by that dimension</p>
    </div>
  );
}

/* ------------------------------------------------------------ parallel sets */
/** Categorical parallel coordinates: ribbons through category axes. */
export function ParallelSets({
  axes, rows, height = 240, label,
}: {
  axes: { label: string; categories: string[] }[];
  rows: { path: number[]; value: number }[]; height?: number; label?: string;
}) {
  if (axes.length < 2 || !rows.length) return null;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const gapY = 4;

  // Per axis: category totals then stacked extents.
  const layout = axes.map((ax, ai) => {
    const sums = ax.categories.map((_, ci) => rows.filter((r) => r.path[ai] === ci).reduce((s, r) => s + r.value, 0));
    const usable = 100 - gapY * (ax.categories.length - 1);
    let y = 0;
    return sums.map((s) => {
      const h = (s / total) * usable;
      const box = { y, h };
      y += h + gapY;
      return box;
    });
  });
  const cursors = layout.map((cats) => cats.map((c) => ({ out: c.y, inn: c.y })));
  const X = (a: number) => (a / (axes.length - 1)) * 88 + 6;

  const ribbons: { d: string; v: number }[] = [];
  for (const r of [...rows].sort((a, b) => b.value - a.value)) {
    for (let a = 0; a < axes.length - 1; a++) {
      const c0 = r.path[a], c1 = r.path[a + 1];
      const h = (r.value / total) * (100 - gapY * (axes[a].categories.length - 1));
      const h1 = (r.value / total) * (100 - gapY * (axes[a + 1].categories.length - 1));
      const y0 = cursors[a][c0].out; cursors[a][c0].out += h;
      const y1 = cursors[a + 1][c1].inn; cursors[a + 1][c1].inn += h1;
      const x0 = X(a) + 1.4, x1 = X(a + 1) - 1.4, mx = (x0 + x1) / 2;
      ribbons.push({
        v: r.value,
        d: `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h1} C ${mx} ${y1 + h1}, ${mx} ${y0 + h}, ${x0} ${y0 + h} Z`,
      });
    }
  }

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} paths across ${axes.length} axes`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {ribbons.map((r, i) => <path key={i} d={r.d} fill={TONE} fillOpacity={0.16} />)}
          {layout.map((cats, ai) =>
            cats.map((c, ci) => (
              <rect key={`${ai}-${ci}`} x={X(ai) - 1.2} y={c.y} width={2.4} height={Math.max(0.6, c.h)} fill={TONE} rx={0.6} />
            ))
          )}
        </svg>
        {layout.map((cats, ai) =>
          cats.map((c, ci) => (
            <span key={`t-${ai}-${ci}`} className="absolute rounded-[2px] px-0.5 text-[8px] whitespace-nowrap text-muted-foreground"
              style={{
                left: `${X(ai)}%`, top: `${c.y + c.h / 2}%`,
                transform: ai === 0 ? "translate(-108%, -50%)" : ai === axes.length - 1 ? "translate(8%, -50%)" : "translate(-50%, -50%)",
                // Middle-axis labels sit ON the ribbons, so they carry their
                // own background — without it they were grey on grey.
                background: "var(--background)",
              }}>
              {axes[ai].categories[ci]}
            </span>
          ))
        )}
      </div>
      <div className="flex justify-between px-2 text-[10px] text-muted-foreground">
        {axes.map((a) => <span key={a.label}>{a.label}</span>)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- cluster scatter */
/** An embedding with each cluster hulled and named. */
export function ClusterScatter({
  points, size = 270, label,
}: {
  points: { x: number; y: number; cluster: string }[]; size?: number; label?: string;
}) {
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xLo = Math.min(...xs), xHi = Math.max(...xs), yLo = Math.min(...ys), yHi = Math.max(...ys);
  const X = (v: number) => ((v - xLo) / (xHi - xLo || 1)) * 90 + 5;
  const Y = (v: number) => 95 - ((v - yLo) / (yHi - yLo || 1)) * 90;

  const clusters = [...new Set(points.map((p) => p.cluster))];
  const hull = (pts: { x: number; y: number }[]) => {
    if (pts.length < 3) return pts;
    // Gift wrapping — n is tiny, clarity wins over asymptotics.
    const start = pts.reduce((a, b) => (b.x < a.x ? b : a));
    const out: typeof pts = [];
    let cur = start;
    do {
      out.push(cur);
      let cand = pts[0] === cur ? pts[1] : pts[0];
      for (const p of pts) {
        if (p === cur) continue;
        const cross = (cand.x - cur.x) * (p.y - cur.y) - (cand.y - cur.y) * (p.x - cur.x);
        if (cross < 0) cand = p;
      }
      cur = cand;
    } while (cur !== start && out.length < pts.length + 1);
    return out;
  };

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${points.length} points in ${clusters.length} clusters`}>
        {clusters.map((c) => {
          const mine = points.filter((p) => p.cluster === c).map((p) => ({ x: X(p.x), y: Y(p.y) }));
          const h = hull(mine);
          const cx = mine.reduce((s, p) => s + p.x, 0) / mine.length;
          const cy = mine.reduce((s, p) => s + p.y, 0) / mine.length;
          return (
            <g key={c}>
              <polygon points={h.map((p) => `${p.x},${p.y}`).join(" ")} fill={TONE} fillOpacity={0.07} stroke={TONE} strokeOpacity={0.35} strokeWidth={0.7} strokeDasharray="3 2" />
              <text x={cx} y={cy} textAnchor="middle" fontSize={7} fontWeight={600} className="fill-foreground">{c}</text>
            </g>
          );
        })}
        {points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={1.4} fill={TONE} fillOpacity={0.55} />)}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Dashed hulls outline each cluster</p>
    </div>
  );
}

/* -------------------------------------------------------------- caterpillar */
/**
 * Ranked estimates with intervals — the random-effects picture.
 *
 * Ranked by estimate, which is what makes the caterpillar shape and lets the
 * eye find "which units differ from the average" without reading any one row.
 */
export function Caterpillar({
  units, centre = 0, height = 230, label,
}: {
  units: { label: string; estimate: number; low: number; high: number }[];
  centre?: number; height?: number; label?: string;
}) {
  if (!units.length) return null;
  const rows = [...units].sort((a, b) => a.estimate - b.estimate);
  const lo = Math.min(...rows.map((r) => r.low), centre);
  const hi = Math.max(...rows.map((r) => r.high), centre);
  const X = (i: number) => (i / (rows.length - 1 || 1)) * 94 + 3;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 92 - 4;
  const clear = rows.filter((r) => r.low > centre || r.high < centre).length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${clear} of ${rows.length} clear the average`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={Y(centre)} y2={Y(centre)} stroke="var(--border)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          {rows.map((r, i) => {
            const solid = r.low > centre || r.high < centre;
            return (
              <g key={r.label}>
                <line x1={X(i)} x2={X(i)} y1={Y(r.high)} y2={Y(r.low)} stroke={TONE} strokeOpacity={solid ? 0.85 : 0.3} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <circle cx={X(i)} cy={Y(r.estimate)} r={solid ? 1.3 : 0.9} fill={TONE} fillOpacity={solid ? 1 : 0.5} />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Ranked left to right · {clear} of {rows.length} intervals clear the dashed average
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- CUSUM */
/**
 * Cumulative sum of deviations from target, with decision limits.
 *
 * The point over a plain control chart: a small persistent shift that never
 * trips a single-point limit accumulates here and walks through the mask.
 */
export function Cusum({
  values, target, k = 0.5, h = 4, height = 210, label,
}: {
  values: number[]; target: number;
  /** Slack and decision limits, in standard deviations. */ k?: number; h?: number;
  height?: number; label?: string;
}) {
  if (values.length < 3) return null;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - target) ** 2, 0) / values.length) || 1;
  let up = 0, dn = 0;
  const hiS: number[] = [], loS: number[] = [];
  for (const v of values) {
    up = Math.max(0, up + (v - target) / sd - k);
    dn = Math.min(0, dn + (v - target) / sd + k);
    hiS.push(up); loS.push(dn);
  }
  const bound = Math.max(h * 1.2, ...hiS, ...loS.map((v) => -v));
  const X = (i: number) => (i / (values.length - 1)) * 100;
  const Y = (v: number) => 50 - (v / bound) * 46;
  const trip = hiS.findIndex((v) => v > h);

  return (
    <div className="w-full" role="img" aria-label={label ?? (trip >= 0 ? `Signal at point ${trip + 1}` : "No signal")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[h, -h].map((g) => (
            <line key={g} x1={0} x2={100} y1={Y(g)} y2={Y(g)} stroke={TONE} strokeOpacity={0.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={100} y1={Y(0)} y2={Y(0)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
          <polyline points={hiS.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <polyline points={loS.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
        </svg>
        {trip >= 0 ? <div className="absolute top-0 bottom-0 border-l border-destructive" style={{ left: `${X(trip)}%` }} /> : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {trip >= 0 ? `Crossed the +${h}σ limit at point ${trip + 1} — a sustained shift, not one bad day` : `Stayed inside ±${h}σ`}
      </p>
    </div>
  );
}
