/** Graph and hierarchy layouts, all deterministic. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------- hive plot */
/**
 * Nodes pinned to a few radial axes by CATEGORY, position along the axis by
 * rank. Unlike a force layout the picture is reproducible and comparable
 * between datasets, which is the entire reason hive plots exist.
 */
export function HivePlot({
  axes, nodes, links, size = 280, label,
}: {
  axes: string[];
  nodes: { id: string; axis: string; rank: number }[];
  links: { source: string; target: string; value?: number }[];
  size?: number; label?: string;
}) {
  if (!axes.length || !nodes.length) return null;
  const cx = size / 2, cy = size / 2;
  const rMin = size * 0.11, rMax = size * 0.42;
  const maxRank = Math.max(1, ...nodes.map((n) => n.rank));

  const place = (n: { axis: string; rank: number }) => {
    const ai = Math.max(0, axes.indexOf(n.axis));
    const a = (ai / axes.length) * Math.PI * 2 - Math.PI / 2;
    const r = rMin + (n.rank / maxRank) * (rMax - rMin);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a };
  };
  const at = (id: string) => { const n = nodes.find((x) => x.id === id); return n ? place(n) : null; };
  const maxV = Math.max(1, ...links.map((l) => l.value ?? 1));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${nodes.length} nodes on ${axes.length} axes`}>
      {axes.map((ax, i) => {
        const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <g key={ax}>
            <line x1={cx + Math.cos(a) * rMin} y1={cy + Math.sin(a) * rMin}
              x2={cx + Math.cos(a) * rMax} y2={cy + Math.sin(a) * rMax} stroke="var(--border)" strokeWidth={1.5} />
            <text x={cx + Math.cos(a) * (rMax + 14)} y={cy + Math.sin(a) * (rMax + 14)}
              textAnchor="middle" dominantBaseline="middle" fontSize={9} className="fill-muted-foreground">{ax}</text>
          </g>
        );
      })}
      {links.map((l, i) => {
        const a = at(l.source), b = at(l.target);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const qx = mx + (cx - mx) * 0.5, qy = my + (cy - my) * 0.5;
        return (
          <path key={i} d={`M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x} ${b.y}`} fill="none"
            stroke={TONE} strokeOpacity={0.28} strokeWidth={0.6 + ((l.value ?? 1) / maxV) * 2} />
        );
      })}
      {nodes.map((n) => {
        const p = place(n);
        return <circle key={n.id} cx={p.x} cy={p.y} r={3} fill={TONE}><title>{n.id}</title></circle>;
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- bipartite */
/** Two disjoint sets, links only between them. */
export function Bipartite({
  left, right, links, width = 420, rowHeight = 30, label,
}: {
  left: string[]; right: string[];
  links: { from: string; to: string; value?: number }[];
  width?: number; rowHeight?: number; label?: string;
}) {
  if (!left.length || !right.length) return null;
  const height = Math.max(left.length, right.length) * rowHeight;
  const yOf = (arr: string[], id: string) => {
    const i = arr.indexOf(id);
    // Centre the shorter column, so an uneven pair does not read as a gap.
    const pad = (height - arr.length * rowHeight) / 2;
    return pad + i * rowHeight + rowHeight / 2;
  };
  const maxV = Math.max(1, ...links.map((l) => l.value ?? 1));
  const xL = 96, xR = width - 96;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${links.length} links between two sets`}>
      {links.map((l, i) => {
        const y1 = yOf(left, l.from), y2 = yOf(right, l.to);
        if (!left.includes(l.from) || !right.includes(l.to)) return null;
        const mid = (xL + xR) / 2;
        return (
          <path key={i} d={`M ${xL} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${xR} ${y2}`} fill="none"
            stroke={TONE} strokeOpacity={0.3} strokeWidth={0.7 + ((l.value ?? 1) / maxV) * 2.6}>
            <title>{`${l.from} → ${l.to}`}</title>
          </path>
        );
      })}
      {left.map((id) => (
        <g key={`l-${id}`}>
          <circle cx={xL} cy={yOf(left, id)} r={3.5} fill={TONE} />
          <text x={xL - 8} y={yOf(left, id)} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-foreground">{id}</text>
        </g>
      ))}
      {right.map((id) => (
        <g key={`r-${id}`}>
          <circle cx={xR} cy={yOf(right, id)} r={3.5} fill={TONE} />
          <text x={xR + 8} y={yOf(right, id)} dominantBaseline="middle" fontSize={10} className="fill-foreground">{id}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- voronoi */
/**
 * Catchment cells around a set of sites.
 *
 * Rasterised — each pixel of a coarse grid coloured by its nearest site —
 * rather than computing exact cell polygons. Fortune's algorithm is a few
 * hundred lines for boundaries that land within a pixel of these.
 */
export function VoronoiMap({
  sites, width = 320, height = 240, grid = 3, label,
}: {
  sites: { label: string; x: number; y: number }[];
  width?: number; height?: number; grid?: number; label?: string;
}) {
  if (!sites.length) return null;
  // A `grid` OF ZERO IS `Math.ceil(width / 0)` = Infinity, and the two loops
  // below then build cells until the process dies. Measured: it took this
  // harness out with a heap-limit abort. A resolution of nought is meaningless,
  // so it falls back to the component's own default rather than being drawn.
  const step = Number.isFinite(grid) && grid > 0 ? grid : 3;
  const cols = Math.ceil(width / step), rows = Math.ceil(height / step);
  const shade = (i: number) => `color-mix(in oklch, var(--foreground) ${8 + (i % 5) * 15}%, var(--muted))`;
  const cells: { x: number; y: number; s: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = (c + 0.5) / cols, py = (r + 0.5) / rows;
      let best = 0, bd = Infinity;
      sites.forEach((s, i) => {
        const d = (s.x - px) ** 2 + (s.y - py) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      cells.push({ x: c * grid, y: r * grid, s: best });
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `Catchment for ${sites.length} sites`}>
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={grid + 0.5} height={grid + 0.5} fill={shade(c.s)} />
      ))}
      {sites.map((s, i) => (
        <g key={s.label}>
          <circle cx={s.x * width} cy={s.y * height} r={4} fill={TONE} stroke="var(--background)" strokeWidth={1.5} />
          <text x={s.x * width} y={s.y * height - 8} textAnchor="middle" fontSize={9} className="fill-foreground">{s.label}</text>
          <title>{`${s.label} — area ${i + 1}`}</title>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------ flame graph */
/** Nested time — width is duration, depth is the call stack. */
/** `value` is optional: a parent's is the sum of its children, and demanding
 *  one on every node forces callers to keep two copies of the same number in
 *  sync by hand. Leaves need it; branches do not. */
export type Frame = { name: string; value?: number; children?: Frame[] };

export function FlameGraph({
  root, rowHeight = 22, label,
}: {
  root: Frame; rowHeight?: number; label?: string;
}) {
  const total = (f: Frame): number => f.value || (f.children ?? []).reduce((s, c) => s + total(c), 0);
  const grand = total(root) || 1;
  const boxes: { name: string; x: number; w: number; d: number; v: number }[] = [];
  const walk = (f: Frame, x: number, w: number, d: number) => {
    boxes.push({ name: f.name, x, w, d, v: total(f) });
    let cx = x;
    for (const c of f.children ?? []) {
      const cw = (total(c) / (total(f) || 1)) * w;
      walk(c, cx, cw, d + 1);
      cx += cw;
    }
  };
  walk(root, 0, 100, 0);
  const depth = Math.max(...boxes.map((b) => b.d)) + 1;

  return (
    <div className="relative w-full" style={{ height: depth * rowHeight }}
      role="img" aria-label={label ?? `Call stack ${depth} deep, ${grand} total`}>
      {boxes.map((b, i) => (
        <div key={`${b.name}-${i}`}
          className="absolute flex items-center overflow-hidden rounded-[2px] border border-background px-1 text-[9px] whitespace-nowrap"
          style={{
            left: `${b.x}%`, width: `${b.w}%`,
            // Deepest at the TOP, which is the flame convention — the stack
            // grows upward from the entry point at the base.
            bottom: b.d * rowHeight, height: rowHeight - 2,
            background: `color-mix(in oklch, var(--foreground) ${Math.round(78 - b.d * 13)}%, var(--muted))`,
            color: b.d < 3 ? "var(--background)" : "var(--foreground)",
          }}
          title={`${b.name}: ${b.v}`}>
          {b.w > 5 ? b.name : ""}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- edge bundling */
/**
 * Nodes on a circle with links pulled towards the centre.
 *
 * The bundling is the point: a plain chord of 40 links is a hairball, and
 * curving them all through the middle groups parallel routes into visible
 * strands.
 */
export function EdgeBundling({
  nodes, links, size = 300, tension = 0.82, label,
}: {
  nodes: { id: string; group?: string }[];
  links: { source: string; target: string; value?: number }[];
  size?: number; tension?: number; label?: string;
}) {
  if (!nodes.length) return null;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 34;
  const pos = new Map(nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return [n.id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a }];
  }));
  const maxV = Math.max(1, ...links.map((l) => l.value ?? 1));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${links.length} bundled links between ${nodes.length} nodes`}>
      {links.map((l, i) => {
        const a = pos.get(l.source), b = pos.get(l.target);
        if (!a || !b) return null;
        const c1x = cx + (a.x - cx) * (1 - tension), c1y = cy + (a.y - cy) * (1 - tension);
        const c2x = cx + (b.x - cx) * (1 - tension), c2y = cy + (b.y - cy) * (1 - tension);
        return (
          <path key={i} d={`M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`}
            fill="none" stroke={TONE} strokeOpacity={0.22} strokeWidth={0.6 + ((l.value ?? 1) / maxV) * 1.8} />
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        const outward = p.a;
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={2.6} fill={TONE} />
            <text x={cx + Math.cos(outward) * (r + 12)} y={cy + Math.sin(outward) * (r + 12)}
              textAnchor={Math.cos(outward) > 0.15 ? "start" : Math.cos(outward) < -0.15 ? "end" : "middle"}
              dominantBaseline="middle" fontSize={8} className="fill-muted-foreground">{n.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------ co-occurrence */
/** How often two things appear together, as a lower-triangle grid. */
export function CoOccurrence({
  labels, matrix, cell = 34, format = (n: number) => String(n), label,
}: {
  labels: string[]; matrix: number[][]; cell?: number; format?: (n: number) => string; label?: string;
}) {
  if (!labels.length) return null;
  const hi = Math.max(...matrix.flat()) || 1;
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `Co-occurrence across ${labels.length} items`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <tbody>
          {labels.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[9px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {labels.map((c, ci) => {
                // Only the lower triangle: co-occurrence is symmetric, and
                // drawing both halves doubles the ink to say the same thing.
                if (ci > ri) return <td key={c} style={{ width: cell }} />;
                const v = matrix[ri]?.[ci] ?? 0;
                return (
                  <td key={c} className="p-0">
                    <div className="flex items-center justify-center rounded-[2px] text-[9px] tabular-nums"
                      style={{
                        width: cell, height: cell,
                        background: ri === ci ? "var(--muted)" : `color-mix(in oklch, var(--foreground) ${Math.round((v / hi) * 88)}%, var(--muted))`,
                        color: v / hi > 0.45 && ri !== ci ? "var(--background)" : "var(--muted-foreground)",
                      }}
                      title={ri === ci ? r : `${r} + ${c}: ${format(v)}`}>
                      {ri === ci ? "" : format(v)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th />
            {labels.map((c) => (
              <td key={c} className="pt-1 text-center text-[9px] text-muted-foreground" style={{ width: cell }}>{c.slice(0, 4)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
