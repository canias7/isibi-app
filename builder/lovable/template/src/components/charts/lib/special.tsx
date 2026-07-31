/** Multi-dimensional and specialised charts. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ SPLOM */
/**
 * Every pair of measures as a small scatter, in a grid.
 *
 * The diagonal carries the variable NAME rather than a pointless self-scatter,
 * which is what makes the grid readable without an external legend.
 */
export function Splom({
  keys, rows, cellSize = 84, labels, label,
}: {
  keys: string[]; rows: Record<string, number>[]; cellSize?: number;
  labels?: Record<string, string>; label?: string;
}) {
  if (!keys.length) return null;
  const range = Object.fromEntries(keys.map((k) => {
    const vs = rows.map((r) => Number(r[k])).filter(Number.isFinite);
    return [k, { lo: Math.min(...vs), hi: Math.max(...vs) }];
  }));

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${keys.length} measures pairwise`}>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${keys.length}, ${cellSize}px)` }}>
        {keys.map((ky) =>
          keys.map((kx) => {
            const same = kx === ky;
            const rx = range[kx], ry = range[ky];
            return (
              <div key={`${ky}-${kx}`} className="relative rounded-[2px] border border-border/60"
                style={{ width: cellSize, height: cellSize }}>
                {same ? (
                  <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] font-medium">
                    {labels?.[kx] ?? kx}
                  </span>
                ) : (
                  rows.map((r, i) => (
                    <span key={i} className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${((Number(r[kx]) - rx.lo) / (rx.hi - rx.lo || 1)) * 88 + 6}%`,
                        top: `${(1 - (Number(r[ky]) - ry.lo) / (ry.hi - ry.lo || 1)) * 88 + 6}%`,
                        background: TONE, opacity: 0.6,
                      }} />
                  ))
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- ternary */
/**
 * Three parts summing to 100%, positioned inside a triangle.
 *
 * Rows are normalised on the way in, because a ternary plot is undefined for
 * anything that does not sum to the whole and silently mis-plots it otherwise.
 */
export function Ternary({
  points, size = 260, corners = ["A", "B", "C"], label,
}: {
  points: { label: string; a: number; b: number; c: number }[];
  size?: number; corners?: [string, string, string] | string[]; label?: string;
}) {
  if (!points.length) return null;
  const h = (size * Math.sqrt(3)) / 2;
  const pad = 22;
  const A = [size / 2, pad] as const;
  const B = [pad, h + pad * 0.6] as const;
  const C = [size - pad, h + pad * 0.6] as const;

  return (
    <svg viewBox={`0 0 ${size} ${h + pad * 1.8}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${points.length} three-part compositions`}>
      <polygon points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}`} fill="none" stroke="var(--border)" />
      {[0.25, 0.5, 0.75].map((t) => (
        <g key={t} stroke="var(--border)" strokeOpacity={0.5}>
          <line x1={A[0] + (B[0] - A[0]) * t} y1={A[1] + (B[1] - A[1]) * t} x2={A[0] + (C[0] - A[0]) * t} y2={A[1] + (C[1] - A[1]) * t} />
          <line x1={B[0] + (A[0] - B[0]) * t} y1={B[1] + (A[1] - B[1]) * t} x2={B[0] + (C[0] - B[0]) * t} y2={B[1] + (C[1] - B[1]) * t} />
          <line x1={C[0] + (A[0] - C[0]) * t} y1={C[1] + (A[1] - C[1]) * t} x2={C[0] + (B[0] - C[0]) * t} y2={C[1] + (B[1] - C[1]) * t} />
        </g>
      ))}
      {points.map((p) => {
        const sum = p.a + p.b + p.c || 1;
        const wa = p.a / sum, wb = p.b / sum, wc = p.c / sum;
        const x = A[0] * wa + B[0] * wb + C[0] * wc;
        const y = A[1] * wa + B[1] * wb + C[1] * wc;
        return (
          <g key={p.label}>
            <circle cx={x} cy={y} r={4} fill={TONE} fillOpacity={0.75}>
              <title>{`${p.label}: ${Math.round(wa * 100)}/${Math.round(wb * 100)}/${Math.round(wc * 100)}`}</title>
            </circle>
            <text x={x} y={y - 7} textAnchor="middle" fontSize={8} className="fill-muted-foreground">{p.label}</text>
          </g>
        );
      })}
      <text x={A[0]} y={A[1] - 8} textAnchor="middle" fontSize={10} className="fill-foreground">{corners[0]}</text>
      <text x={B[0]} y={B[1] + 14} textAnchor="middle" fontSize={10} className="fill-foreground">{corners[1]}</text>
      <text x={C[0]} y={C[1] + 14} textAnchor="middle" fontSize={10} className="fill-foreground">{corners[2]}</text>
    </svg>
  );
}

/* ---------------------------------------------------------- polar scatter */
/** Points by angle and radius — direction and distance, or time of day. */
export function PolarScatter({
  points, size = 260, rings = 4, maxRadius, angleLabels, label,
}: {
  points: { angle: number; radius: number; label?: string }[];
  size?: number; rings?: number; maxRadius?: number; angleLabels?: string[]; label?: string;
}) {
  if (!points.length) return null;
  const R = size / 2 - 22;
  const cx = size / 2, cy = size / 2;
  const hi = maxRadius ?? (Math.max(...points.map((p) => p.radius)) || 1);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${points.length} points by angle and distance`}>
      {Array.from({ length: rings }, (_, i) => (
        <circle key={i} cx={cx} cy={cy} r={(R * (i + 1)) / rings} fill="none" stroke="var(--border)" strokeOpacity={0.6} />
      ))}
      {(angleLabels ?? []).map((l, i, arr) => {
        const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <g key={l}>
            <line x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--border)" strokeOpacity={0.4} />
            <text x={cx + Math.cos(a) * (R + 12)} y={cy + Math.sin(a) * (R + 12)} textAnchor="middle"
              dominantBaseline="middle" fontSize={9} className="fill-muted-foreground">{l}</text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const a = (p.angle * Math.PI) / 180 - Math.PI / 2;
        const r = (p.radius / hi) * R;
        return (
          <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={3.5} fill={TONE} fillOpacity={0.7}>
            <title>{p.label ?? `${p.angle}° at ${p.radius}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------- vector field */
/** Direction and magnitude on a grid. Arrowheads, because a line has no sense of direction. */
export function VectorField({
  vectors, width = 300, height = 220, label,
}: {
  vectors: { x: number; y: number; angle: number; magnitude: number }[];
  width?: number; height?: number; label?: string;
}) {
  if (!vectors.length) return null;
  const hi = Math.max(...vectors.map((v) => v.magnitude)) || 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${vectors.length} vectors`}>
      {vectors.map((v, i) => {
        const len = 6 + (v.magnitude / hi) * 16;
        const a = (v.angle * Math.PI) / 180;
        const x1 = v.x * width, y1 = (1 - v.y) * height;
        const x2 = x1 + Math.cos(a) * len, y2 = y1 - Math.sin(a) * len;
        const head = 3.4;
        return (
          <g key={i} stroke={TONE} strokeOpacity={0.3 + (v.magnitude / hi) * 0.6} strokeWidth={1.2}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <polygon
              points={`${x2},${y2} ${x2 - Math.cos(a - 0.5) * head},${y2 + Math.sin(a - 0.5) * head} ${x2 - Math.cos(a + 0.5) * head},${y2 + Math.sin(a + 0.5) * head}`}
              fill={TONE} stroke="none" fillOpacity={0.3 + (v.magnitude / hi) * 0.6} />
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ glyph plot */
/** A tiny radar per row — many multivariate records compared by silhouette. */
export function GlyphPlot({
  keys, rows, size = 76, columns = 5, label,
}: {
  keys: string[]; rows: { label: string; values: Record<string, number> }[];
  size?: number; columns?: number; label?: string;
}) {
  if (!rows.length) return null;
  const range = Object.fromEntries(keys.map((k) => {
    const vs = rows.map((r) => r.values[k]);
    return [k, { lo: Math.min(...vs), hi: Math.max(...vs) }];
  }));

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      role="img" aria-label={label ?? `${rows.length} records across ${keys.length} measures`}>
      {rows.map((r) => {
        const pts = keys.map((k, i) => {
          const a = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
          const t = (r.values[k] - range[k].lo) / (range[k].hi - range[k].lo || 1);
          const rad = (0.2 + t * 0.8) * (size / 2 - 4);
          return `${size / 2 + Math.cos(a) * rad},${size / 2 + Math.sin(a) * rad}`;
        });
        return (
          <div key={r.label} className="flex flex-col items-center">
            <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
              <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="none" stroke="var(--border)" strokeOpacity={0.6} />
              <polygon points={pts.join(" ")} fill={TONE} fillOpacity={0.2} stroke={TONE} strokeWidth={1.2} />
            </svg>
            <span className="mt-1 truncate text-[10px] text-muted-foreground">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- OHLC bars */
/**
 * The other financial notation: a vertical range with a left tick for the
 * open and a right tick for the close. Less ink than a candle and it never
 * relies on fill, so it survives being printed.
 */
export function OHLC({
  bars, height = 220, format = (n: number) => n.toFixed(2), label,
}: {
  bars: { label: string; open: number; high: number; low: number; close: number }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!bars.length) return null;
  const lo = Math.min(...bars.map((b) => b.low)), hi = Math.max(...bars.map((b) => b.high));
  const span = hi - lo || 1;
  const Y = (v: number) => ((hi - v) / span) * 100;
  const slot = 100 / bars.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${bars.length} OHLC bars`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {bars.map((b, i) => {
            const cx = i * slot + slot / 2;
            const tick = slot * 0.3;
            return (
              <g key={`${b.label}-${i}`} stroke={TONE} strokeWidth={1.2} vectorEffect="non-scaling-stroke">
                <line x1={cx} x2={cx} y1={Y(b.high)} y2={Y(b.low)} />
                <line x1={cx - tick} x2={cx} y1={Y(b.open)} y2={Y(b.open)} />
                <line x1={cx} x2={cx + tick} y1={Y(b.close)} y2={Y(b.close)} />
                <title>{`${b.label} O ${format(b.open)} H ${format(b.high)} L ${format(b.low)} C ${format(b.close)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(lo)}</span><span>{format(hi)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ depth chart */
/** Cumulative bids and asks either side of a mid price. */
export function DepthChart({
  bids, asks, height = 200, format = (n: number) => n.toFixed(2), label,
}: {
  bids: { price: number; size: number }[]; asks: { price: number; size: number }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!bids.length || !asks.length) return null;
  const b = [...bids].sort((x, y) => y.price - x.price);
  const a = [...asks].sort((x, y) => x.price - y.price);
  let cb = 0, ca = 0;
  const bc = b.map((p) => ({ price: p.price, cum: (cb += p.size) }));
  const ac = a.map((p) => ({ price: p.price, cum: (ca += p.size) }));
  const lo = Math.min(...b.map((p) => p.price)), hi = Math.max(...a.map((p) => p.price));
  const span = hi - lo || 1;
  const peak = Math.max(cb, ca) || 1;
  const X = (p: number) => ((p - lo) / span) * 100;
  const Y = (c: number) => 100 - (c / peak) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Order book depth between ${format(lo)} and ${format(hi)}`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`${X(bc[bc.length - 1].price)},100 ${bc.map((p) => `${X(p.price)},${Y(p.cum)}`).reverse().join(" ")} ${X(bc[0].price)},100`}
            fill={TONE} fillOpacity={0.22} stroke={TONE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <polygon points={`${X(ac[0].price)},100 ${ac.map((p) => `${X(p.price)},${Y(p.cum)}`).join(" ")} ${X(ac[ac.length - 1].price)},100`}
            fill={TONE} fillOpacity={0.08} stroke={TONE} strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Bids (solid) {format(lo)}</span><span>Asks (dashed) {format(hi)}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- flow map */
/**
 * Origin to destination on the same tile grid `choropleth` uses, for the same
 * reason: real coordinates need a mapping dependency or embedded GeoJSON.
 */
export function FlowMap({
  places, flows, cell = 40, gap = 6, label,
}: {
  places: { id: string; row: number; col: number; value?: number }[];
  flows: { from: string; to: string; value: number }[];
  cell?: number; gap?: number; label?: string;
}) {
  if (!places.length) return null;
  const step = cell + gap;
  const rows = Math.max(...places.map((p) => p.row)) + 1;
  const cols = Math.max(...places.map((p) => p.col)) + 1;
  const W = cols * step, H = rows * step;
  const at = (id: string) => places.find((p) => p.id === id);
  const maxF = Math.max(...flows.map((f) => f.value)) || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}
      role="img" aria-label={label ?? `${flows.length} flows between ${places.length} places`}>
      {flows.map((f, i) => {
        const a = at(f.from), b = at(f.to);
        if (!a || !b) return null;
        const x1 = a.col * step + cell / 2, y1 = a.row * step + cell / 2;
        const x2 = b.col * step + cell / 2, y2 = b.row * step + cell / 2;
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.16;
        const my = (y1 + y2) / 2 - (x2 - x1) * 0.16;
        return (
          <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none"
            stroke={TONE} strokeOpacity={0.3} strokeWidth={0.8 + (f.value / maxF) * 4} strokeLinecap="round">
            <title>{`${f.from} → ${f.to}: ${f.value}`}</title>
          </path>
        );
      })}
      {places.map((p) => (
        <g key={p.id}>
          <rect x={p.col * step} y={p.row * step} width={cell} height={cell} rx={4}
            fill="var(--muted)" stroke="var(--border)" />
          <text x={p.col * step + cell / 2} y={p.row * step + cell / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} className="fill-foreground">{p.id}</text>
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------------------------------- value cartogram */
/** Tiles SIZED by value rather than shaded by it — magnitude, not intensity. */
export function ValueCartogram({
  regions, cell = 46, gap = 6, format = (n: number) => String(n), label,
}: {
  regions: { id: string; row: number; col: number; value: number }[];
  cell?: number; gap?: number; format?: (n: number) => string; label?: string;
}) {
  if (!regions.length) return null;
  const step = cell + gap;
  const rows = Math.max(...regions.map((r) => r.row)) + 1;
  const cols = Math.max(...regions.map((r) => r.col)) + 1;
  const hi = Math.max(...regions.map((r) => r.value)) || 1;

  return (
    <div className="relative" style={{ width: cols * step, height: rows * step }}
      role="img" aria-label={label ?? `${regions.length} regions sized by value`}>
      {regions.map((r) => {
        // Area proportional to value, so a tile twice as big really is twice
        // the number. Scaling the SIDE would square the difference.
        const s = Math.max(8, Math.sqrt(r.value / hi) * cell);
        return (
          <div key={r.id} className="absolute flex items-center justify-center rounded-[3px] text-[9px]"
            style={{
              left: r.col * step + (cell - s) / 2, top: r.row * step + (cell - s) / 2,
              width: s, height: s, background: TONE, color: "var(--background)",
            }}
            title={`${r.id}: ${format(r.value)}`}>
            {s > 26 ? r.id : ""}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------- gantt with deps */
/** A schedule where the arrows say what is waiting on what. */
export function GanttDeps({
  tasks, ticks, rowHeight = 34, labelWidth = 90, label,
}: {
  tasks: { id: string; name: string; start: number; end: number; after?: string[] }[];
  ticks?: string[]; rowHeight?: number; labelWidth?: number; label?: string;
}) {
  if (!tasks.length) return null;
  const lo = Math.min(...tasks.map((t) => t.start));
  const hi = Math.max(...tasks.map((t) => t.end));
  const span = hi - lo || 1;
  const X = (v: number) => ((v - lo) / span) * 100;
  const H = tasks.length * rowHeight;
  const idx = (id: string) => tasks.findIndex((t) => t.id === id);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${tasks.length} tasks with dependencies`}>
      {ticks?.length ? (
        <div className="flex" style={{ paddingLeft: labelWidth }}>
          {ticks.map((t) => <span key={t} className="flex-1 text-[10px] text-muted-foreground">{t}</span>)}
        </div>
      ) : null}
      <div className="flex">
        <div style={{ width: labelWidth }} className="shrink-0">
          {tasks.map((t) => (
            <div key={t.id} style={{ height: rowHeight }} className="flex items-center pr-2 text-[10px] text-muted-foreground">
              <span className="truncate">{t.name}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
            {tasks.flatMap((t, ti) =>
              (t.after ?? []).map((dep, di) => {
                const pi = idx(dep);
                if (pi < 0) return null;
                const x1 = X(tasks[pi].end), y1 = pi * rowHeight + rowHeight / 2;
                const x2 = X(t.start), y2 = ti * rowHeight + rowHeight / 2;
                return (
                  <path key={`${t.id}-${di}`} d={`M ${x1} ${y1} L ${(x1 + x2) / 2} ${y1} L ${(x1 + x2) / 2} ${y2} L ${x2} ${y2}`}
                    fill="none" stroke={TONE} strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                );
              })
            )}
          </svg>
          {tasks.map((t, ti) => (
            <div key={t.id} className="absolute rounded-[3px]"
              style={{ left: `${X(t.start)}%`, width: `${Math.max(0.8, X(t.end) - X(t.start))}%`, top: ti * rowHeight + 7, height: rowHeight - 16, background: TONE }}
              title={`${t.name}${t.after?.length ? ` — after ${t.after.join(", ")}` : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
