/**
 * Distribution charts that recharts cannot draw. All deterministic — no
 * Math.random anywhere, so the same data always produces the same picture.
 */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ shared */

/** Deterministic pseudo-random stream. Seeded so renders are reproducible. */
export function rng(seed = 1) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 100000) / 100000; };
}

export function sample(n: number, centre = 50, spread = 14, seed = 5): number[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const g = (r() + r() + r()) / 3 - 0.5;
    return Math.round(centre + g * spread * 4);
  });
}

const gauss = (u: number) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);

export function kde(values: number[], lo: number, hi: number, steps: number, bw?: number) {
  const n = values.length || 1;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
  const h = bw ?? 1.06 * sd * Math.pow(n, -1 / 5);
  return Array.from({ length: steps }, (_, i) => {
    const x = lo + ((hi - lo) * i) / (steps - 1);
    return values.reduce((s, v) => s + gauss((x - v) / h), 0) / (n * h);
  });
}

/* --------------------------------------------------------------- beeswarm */
/**
 * Every observation drawn, nudged perpendicular so none overlap.
 *
 * The point is that nothing is summarised away: a box plot showing a tidy
 * median can be hiding nine points and one at the far end, and this shows it.
 */
export function Beeswarm({
  groups, height = 220, radius = 3, min, max, format = (n: number) => String(Math.round(n)), label,
}: {
  groups: { label: string; values: number[] }[];
  height?: number; radius?: number; min?: number; max?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.values);
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const span = hi - lo || 1;
  const slot = 100 / groups.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${all.length} observations across ${groups.length} groups`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        {groups.map((g, gi) => {
          const centre = gi * slot + slot / 2;
          // Bin by position, then fan each bin out either side of the axis.
          // A random jitter would move every dot on every render.
          const bins = new Map<number, number>();
          return g.values.map((v, i) => {
            const y = 100 - ((v - lo) / span) * 100;
            const key = Math.round(y * 1.6);
            const k = bins.get(key) ?? 0;
            bins.set(key, k + 1);
            const side = k % 2 === 0 ? 1 : -1;
            const step = Math.ceil(k / 2) * (radius * 0.55);
            return (
              <circle key={`${gi}-${i}`} cx={centre + side * step} cy={y} r={radius * 0.5}
                fill={TONE} fillOpacity={0.55} vectorEffect="non-scaling-stroke">
                <title>{format(v)}</title>
              </circle>
            );
          });
        })}
      </svg>
      <div className="flex">
        {groups.map((g) => (
          <div key={g.label} className="truncate px-1 text-center text-[10px] text-muted-foreground" style={{ width: `${slot}%` }}>
            {g.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- strip plot */
/** Raw points on one axis per category. Nothing computed at all. */
export function StripPlot({
  groups, height = 200, min, max, label,
}: {
  groups: { label: string; values: number[] }[];
  height?: number; min?: number; max?: number; label?: string;
}) {
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.values);
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const span = hi - lo || 1;
  const rowH = height / groups.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${all.length} observations`}>
      {groups.map((g) => (
        <div key={g.label} className="flex items-center gap-2" style={{ height: rowH }}>
          <span className="w-16 shrink-0 truncate text-right text-[10px] text-muted-foreground">{g.label}</span>
          <div className="relative h-full flex-1">
            <div className="absolute top-1/2 right-0 left-0 border-t border-border" />
            {g.values.map((v, i) => (
              <span key={i} className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${((v - lo) / span) * 100}%`, background: TONE, opacity: 0.45 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- ridgeline */
/**
 * Densities stacked with overlap — how a distribution's SHAPE moves over time.
 *
 * Rows are drawn back-to-front and filled opaquely, or the overlap turns into
 * an unreadable mesh instead of reading as depth.
 */
export function Ridgeline({
  rows, height = 260, overlap = 0.55, steps = 64, min, max, label,
}: {
  rows: { label: string; values: number[] }[];
  height?: number; overlap?: number; steps?: number; min?: number; max?: number; label?: string;
}) {
  if (!rows.length) return null;
  const all = rows.flatMap((r) => r.values);
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const curves = rows.map((r) => kde(r.values, lo, hi, steps));
  const peak = Math.max(...curves.flat()) || 1;
  const rowH = height / rows.length;
  const amp = rowH * (1 + overlap);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} distributions`}>
      <div className="relative" style={{ height: height + amp * 0.4 }}>
        {rows.map((r, i) => {
          const pts = curves[i].map((v, k) => `${(k / (steps - 1)) * 100},${amp - (v / peak) * amp}`);
          return (
            <div key={r.label} className="absolute right-0 left-0" style={{ top: i * rowH, height: amp, zIndex: rows.length - i }}>
              <svg viewBox={`0 0 100 ${amp}`} preserveAspectRatio="none" className="h-full w-full">
                <polygon points={`0,${amp} ${pts.join(" ")} 100,${amp}`}
                  fill="var(--background)" stroke="none" />
                <polygon points={`0,${amp} ${pts.join(" ")} 100,${amp}`}
                  fill={TONE} fillOpacity={0.14} stroke={TONE} strokeOpacity={0.65}
                  strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="absolute top-0 left-0 text-[10px] text-muted-foreground">{r.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- ECDF */
/** Share of observations at or below each value. Answers "what % under X". */
export function ECDF({
  values, height = 200, format = (n: number) => String(Math.round(n)), marker, label,
}: {
  values: number[]; height?: number; format?: (n: number) => string; marker?: number; label?: string;
}) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const lo = s[0], hi = s[s.length - 1];
  const span = hi - lo || 1;
  const pts = s.map((v, i) => `${((v - lo) / span) * 100},${100 - ((i + 1) / s.length) * 100}`);
  const below = marker !== undefined ? s.filter((v) => v <= marker).length / s.length : 0;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Cumulative distribution of ${s.length} values`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={pts.join(" ")} fill="none" stroke={TONE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {marker !== undefined ? (
            <>
              <line x1={((marker - lo) / span) * 100} x2={((marker - lo) / span) * 100} y1={0} y2={100}
                stroke={TONE} strokeDasharray="3 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
              <line x1={0} x2={100} y1={100 - below * 100} y2={100 - below * 100}
                stroke={TONE} strokeDasharray="3 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(lo)}</span>
        {marker !== undefined ? <span>{Math.round(below * 100)}% at or below {format(marker)}</span> : null}
        <span>{format(hi)}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- hexbin */
/**
 * Density in hexagonal bins — the answer when a scatter plot has so many
 * points it is one solid blob and tells you nothing about where they pile up.
 */
export function Hexbin({
  points, size = 9, width = 320, height = 220, levels, label,
}: {
  points: { x: number; y: number }[];
  size?: number; width?: number; height?: number;
  levels?: string[]; label?: string;
}) {
  if (!points.length) return null;
  const ramp = levels ?? [
    "color-mix(in oklch, var(--foreground) 12%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 32%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 55%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 78%, var(--muted))",
    TONE,
  ];
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);

  const hw = size * Math.sqrt(3);
  const hh = size * 1.5;
  const bins = new Map<string, { cx: number; cy: number; n: number }>();
  for (const p of points) {
    const px = ((p.x - x0) / (x1 - x0 || 1)) * (width - hw) + hw / 2;
    const py = (1 - (p.y - y0) / (y1 - y0 || 1)) * (height - size * 2) + size;
    const row = Math.round(py / hh);
    const off = row % 2 ? hw / 2 : 0;
    const col = Math.round((px - off) / hw);
    const key = `${row}:${col}`;
    const cell = bins.get(key) ?? { cx: col * hw + off, cy: row * hh, n: 0 };
    cell.n++;
    bins.set(key, cell);
  }
  const cells = [...bins.values()];
  const peak = Math.max(...cells.map((c) => c.n)) || 1;
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return `${(cx + size * Math.cos(a)).toFixed(1)},${(cy + size * Math.sin(a)).toFixed(1)}`;
    }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${points.length} points in ${cells.length} bins`}>
      {cells.map((c, i) => (
        <polygon key={i} points={hex(c.cx, c.cy)}
          fill={ramp[Math.min(ramp.length - 1, Math.floor((c.n / peak) * (ramp.length - 0.001)))]}>
          <title>{`${c.n} points`}</title>
        </polygon>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- contour */
/** The same 2-D density as level curves rather than filled bins. */
export function ContourPlot({
  points, width = 320, height = 220, rings = 5, grid = 26, label,
}: {
  points: { x: number; y: number }[];
  width?: number; height?: number; rings?: number; grid?: number; label?: string;
}) {
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const h = Math.max((x1 - x0), (y1 - y0)) / 10 || 1;

  // Density on a coarse grid, then one filled rect per cell above each
  // threshold. Marching squares would give smooth isolines and a lot more
  // code for a chart nobody reads to three decimal places.
  const cells: { gx: number; gy: number; d: number }[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const px = x0 + ((x1 - x0) * gx) / (grid - 1);
      const py = y0 + ((y1 - y0) * gy) / (grid - 1);
      let d = 0;
      for (const p of points) {
        const dx = (p.x - px) / h, dy = (p.y - py) / h;
        d += Math.exp(-0.5 * (dx * dx + dy * dy));
      }
      cells.push({ gx, gy, d });
    }
  }
  const peak = Math.max(...cells.map((c) => c.d)) || 1;
  const cw = width / grid, ch = height / grid;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `Density contours over ${points.length} points`}>
      {Array.from({ length: rings }, (_, r) => {
        const t = ((r + 1) / (rings + 1)) * peak;
        return (
          <g key={r} fill={TONE} fillOpacity={0.1}>
            {cells.filter((c) => c.d >= t).map((c, i) => (
              <rect key={i} x={c.gx * cw} y={height - (c.gy + 1) * ch} width={cw + 0.5} height={ch + 0.5} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------- QQ plot */
/** Sample quantiles against normal ones. A straight line means normal. */
export function QQPlot({ values, size = 240, label }: { values: number[]; size?: number; label?: string }) {
  if (values.length < 2) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;

  // Acklam's inverse-normal approximation, plenty accurate for a plot.
  const probit = (p: number) => {
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    const q = p - 0.5, r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  };

  const pts = s.map((v, i) => ({ t: probit((i + 0.5) / n), v }));
  const tLo = pts[0].t, tHi = pts[pts.length - 1].t;
  const vLo = s[0], vHi = s[n - 1];
  const X = (t: number) => ((t - tLo) / (tHi - tLo || 1)) * size;
  const Y = (v: number) => size - ((v - vLo) / (vHi - vLo || 1)) * size;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `Quantile-quantile plot of ${n} values`}>
      <line x1={X(tLo)} y1={Y(mean + tLo * sd)} x2={X(tHi)} y2={Y(mean + tHi * sd)}
        stroke={TONE} strokeOpacity={0.4} strokeDasharray="4 4" />
      {pts.map((p, i) => <circle key={i} cx={X(p.t)} cy={Y(p.v)} r={2} fill={TONE} fillOpacity={0.65} />)}
    </svg>
  );
}
