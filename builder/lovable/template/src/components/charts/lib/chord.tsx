/**
 * Flows between every pair in a set — a square matrix drawn as arcs joined by
 * ribbons.
 *
 * Each group's arc is sized by its TOTAL traffic (out plus in), so the ring
 * reads as "who is involved most" before any ribbon is followed. Ribbons are
 * drawn widest-first, or the small ones vanish underneath the large ones.
 */
export function Chord({
  labels,
  matrix,
  size = 280,
  ribbonOpacity = 0.28,
  showLabels = true,
  colors,
  gapDeg = 3,
  label,
}: {
  labels: string[];
  /** matrix[from][to] */
  matrix: number[][];
  size?: number;
  ribbonOpacity?: number;
  showLabels?: boolean;
  colors?: string[];
  gapDeg?: number;
  label?: string;
}) {
  const n = labels.length;
  if (!n) return null;

  const pad = showLabels ? 34 : 10;
  const R = size / 2 - pad;
  const inner = R - 10;
  const cx = size / 2;
  const cy = size / 2;

  const totals = labels.map((_, i) =>
    matrix[i].reduce((s, v) => s + v, 0) + matrix.reduce((s, row) => s + row[i], 0)
  );
  const grand = totals.reduce((s, v) => s + v, 0) || 1;
  const gap = (gapDeg * Math.PI) / 180;
  const usable = Math.PI * 2 - gap * n;

  const arcs: { from: number; to: number }[] = [];
  let a = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const w = (totals[i] / grand) * usable;
    arcs.push({ from: a, to: a + w });
    a += w + gap;
  }

  const pt = (ang: number, rad: number) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad] as const;
  const arcPath = (from: number, to: number, rad: number) => {
    const [x1, y1] = pt(from, rad);
    const [x2, y2] = pt(to, rad);
    return `M ${x1} ${y1} A ${rad} ${rad} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  };

  // Each group's arc is sub-divided into one slot per counterpart, so a ribbon
  // leaves and lands in a consistent place rather than all of them meeting at
  // the arc's midpoint.
  const cursor = arcs.map((x) => x.from);
  const slot = (i: number, amount: number) => {
    const w = (amount / (totals[i] || 1)) * (arcs[i].to - arcs[i].from);
    const from = cursor[i];
    cursor[i] += w;
    return { from, to: from + w };
  };

  const ribbons: { i: number; j: number; a: { from: number; to: number }; b: { from: number; to: number }; v: number }[] = [];
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = matrix[i]?.[j] ?? 0;
    if (v > 0) pairs.push([i, j, v]);
  }
  pairs.sort((p, q) => q[2] - p[2]);
  for (const [i, j, v] of pairs) ribbons.push({ i, j, v, a: slot(i, v), b: slot(j, v) });

  const fill = (i: number) => colors?.[i % colors.length] ?? "var(--foreground)";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `Flows between ${n} groups`}>
      {ribbons.map((r, k) => {
        const [x1, y1] = pt(r.a.from, inner);
        const [x2, y2] = pt(r.a.to, inner);
        const [x3, y3] = pt(r.b.from, inner);
        const [x4, y4] = pt(r.b.to, inner);
        return (
          <path key={k}
            d={`M ${x1} ${y1} A ${inner} ${inner} 0 0 1 ${x2} ${y2} Q ${cx} ${cy} ${x3} ${y3} A ${inner} ${inner} 0 0 1 ${x4} ${y4} Q ${cx} ${cy} ${x1} ${y1} Z`}
            fill={fill(r.i)} fillOpacity={ribbonOpacity}>
            <title>{`${labels[r.i]} → ${labels[r.j]}: ${r.v}`}</title>
          </path>
        );
      })}
      {arcs.map((arc, i) => (
        <path key={i} d={arcPath(arc.from, arc.to, R)} stroke={fill(i)} strokeWidth={8} fill="none">
          <title>{`${labels[i]}: ${totals[i]}`}</title>
        </path>
      ))}
      {showLabels
        ? arcs.map((arc, i) => {
            const mid = (arc.from + arc.to) / 2;
            const [tx, ty] = pt(mid, R + 14);
            return (
              <text key={i} x={tx} y={ty} textAnchor={Math.cos(mid) > 0.1 ? "start" : Math.cos(mid) < -0.1 ? "end" : "middle"}
                dominantBaseline="middle" className="fill-muted-foreground" fontSize={9}>
                {labels[i]}
              </text>
            );
          })
        : null}
    </svg>
  );
}

export const SERVICE_LABELS = ["Cut", "Beard", "Colour", "Wash", "Towel"];
export const SERVICE_MATRIX = [
  [0, 18, 4, 22, 9],
  [14, 0, 2, 8, 11],
  [6, 3, 0, 12, 2],
  [17, 6, 9, 0, 4],
  [7, 9, 1, 5, 0],
];
