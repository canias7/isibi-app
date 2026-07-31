/**
 * Nodes and the links between them.
 *
 * The layout is DETERMINISTIC — circular by default, or positions supplied by
 * the caller. No force simulation: one would need an animation loop and a
 * random seed, which means the same data draws a different picture on every
 * render, and a chart that will not sit still cannot be screenshotted, diffed
 * or described. A circle is legible up to ~20 nodes, which is the range a
 * business site is ever in.
 */
export type Node = { id: string; label?: string; weight?: number; x?: number; y?: number };
export type Link = { source: string; target: string; value?: number };

export function Network({
  nodes,
  links,
  size = 260,
  layout = "circle",
  showLabels = true,
  curved = false,
  label,
}: {
  nodes: Node[];
  links: Link[];
  size?: number;
  layout?: "circle" | "given";
  showLabels?: boolean;
  curved?: boolean;
  label?: string;
}) {
  if (!nodes.length) return null;

  const pad = showLabels ? 34 : 14;
  const r = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;

  const placed = nodes.map((n, i) => {
    if (layout === "given" && n.x !== undefined && n.y !== undefined) {
      return { ...n, px: n.x * size, py: n.y * size };
    }
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { ...n, px: cx + Math.cos(a) * r, py: cy + Math.sin(a) * r };
  });
  const at = (id: string) => placed.find((p) => p.id === id);

  const maxV = Math.max(1, ...links.map((l) => l.value ?? 1));
  const maxW = Math.max(1, ...nodes.map((n) => n.weight ?? 1));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${nodes.length} nodes and ${links.length} links`}>
      {links.map((l, i) => {
        const a = at(l.source);
        const b = at(l.target);
        if (!a || !b) return null;
        const w = 0.6 + ((l.value ?? 1) / maxV) * 2.4;
        if (!curved) {
          return <line key={i} x1={a.px} y1={a.py} x2={b.px} y2={b.py}
            stroke="var(--foreground)" strokeOpacity={0.25} strokeWidth={w} />;
        }
        // Bowed towards the centre, so links between neighbours do not lie on
        // top of the ring itself and disappear into it.
        const mx = (a.px + b.px) / 2;
        const my = (a.py + b.py) / 2;
        const qx = mx + (cx - mx) * 0.4;
        const qy = my + (cy - my) * 0.4;
        return <path key={i} d={`M ${a.px} ${a.py} Q ${qx} ${qy} ${b.px} ${b.py}`}
          fill="none" stroke="var(--foreground)" strokeOpacity={0.25} strokeWidth={w} />;
      })}
      {placed.map((n) => {
        const rad = 4 + ((n.weight ?? 1) / maxW) * 6;
        return (
          <g key={n.id}>
            <circle cx={n.px} cy={n.py} r={rad} fill="var(--foreground)">
              <title>{n.label ?? n.id}</title>
            </circle>
            {showLabels ? (
              <text
                x={n.px}
                y={n.py + (n.py < cy ? -rad - 5 : rad + 11)}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {n.label ?? n.id}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export const SERVICE_NODES: Node[] = [
  { id: "Cut", weight: 9 }, { id: "Beard", weight: 6 }, { id: "Colour", weight: 4 },
  { id: "Towel", weight: 3 }, { id: "Kids", weight: 2 }, { id: "Wash", weight: 5 },
];
export const SERVICE_LINKS: Link[] = [
  { source: "Cut", target: "Beard", value: 8 },
  { source: "Cut", target: "Wash", value: 6 },
  { source: "Cut", target: "Towel", value: 3 },
  { source: "Beard", target: "Towel", value: 4 },
  { source: "Colour", target: "Wash", value: 5 },
  { source: "Colour", target: "Cut", value: 2 },
  { source: "Kids", target: "Cut", value: 1 },
];
