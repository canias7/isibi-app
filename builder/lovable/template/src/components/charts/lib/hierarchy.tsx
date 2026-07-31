/** Part-to-whole and hierarchy charts with no recharts equivalent. */

const TONE = "var(--foreground)";
const SHADE = (i: number, of = 5) => `color-mix(in oklch, var(--foreground) ${Math.round(94 - (i / Math.max(1, of)) * 78)}%, transparent)`;

export type TreeNode = { name: string; value?: number; children?: TreeNode[] };

const total = (n: TreeNode): number => n.value ?? (n.children ?? []).reduce((s, c) => s + total(c), 0);

/* ----------------------------------------------------------------- waffle */
/**
 * A 10x10 grid where one square is one percent.
 *
 * Better than a pie for a part-to-whole a person has to READ a number off:
 * counting squares is exact, judging the angle of a slice is not.
 */
export function Waffle({
  parts, columns = 10, rows = 10, cell = 16, gap = 3, tones, label,
}: {
  parts: { label: string; value: number }[];
  columns?: number; rows?: number; cell?: number; gap?: number; tones?: string[]; label?: string;
}) {
  if (!parts.length) return null;
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  const slots = columns * rows;
  const ramp = tones ?? parts.map((_, i) => SHADE(i, parts.length));

  // Largest-remainder, so the squares always add to exactly `slots`. Plain
  // rounding leaves 99 or 101 squares and the grid comes out ragged.
  const exact = parts.map((p) => (p.value / sum) * slots);
  const counts = exact.map(Math.floor);
  let left = slots - counts.reduce((s, v) => s + v, 0);
  [...exact.map((e, i) => ({ i, frac: e - Math.floor(e) }))]
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (left > 0) { counts[i]++; left--; } });

  const cells: number[] = [];
  counts.forEach((c, i) => { for (let k = 0; k < c; k++) cells.push(i); });

  return (
    <div className="w-full" role="img" aria-label={label ?? parts.map((p, i) => `${p.label} ${counts[i]}%`).join(", ")}>
      <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${columns}, ${cell}px)`, gap }}>
        {cells.map((pi, i) => (
          <span key={i} className="rounded-[2px]" style={{ width: cell, height: cell, background: ramp[pi] }}
            title={parts[pi].label} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p, i) => (
          <span key={p.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ramp[i] }} />
            {p.label} <span className="tabular-nums">{counts[i]}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- pictogram */
/** Units as repeated glyphs. One icon = one countable thing. */
export function Pictogram({
  rows, per = 1, glyph = "●", size = 14, label,
}: {
  rows: { label: string; value: number }[];
  /** How many real units each glyph stands for. */
  per?: number; glyph?: string; size?: number; label?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="w-full space-y-2" role="img" aria-label={label ?? rows.map((r) => `${r.label} ${r.value}`).join(", ")}>
      {rows.map((r) => {
        const whole = Math.floor(r.value / per);
        const part = (r.value / per) - whole;
        return (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-right text-[10px] text-muted-foreground">{r.label}</span>
            <span className="flex flex-wrap items-center gap-[3px] leading-none" style={{ fontSize: size, color: TONE }}>
              {Array.from({ length: whole }, (_, i) => <span key={i}>{glyph}</span>)}
              {part > 0.08 ? <span style={{ opacity: 0.35 }}>{glyph}</span> : null}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{r.value}</span>
          </div>
        );
      })}
      {per !== 1 ? <p className="text-[10px] text-muted-foreground">One {glyph} = {per}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------- circle packing */
/** Nested circles sized by value. Deterministic ring layout, no simulation. */
export function CirclePacking({ root, size = 280, label }: { root: TreeNode; size?: number; label?: string }) {
  const kids = root.children ?? [];
  if (!kids.length) return null;
  const grand = total(root) || 1;
  const R = size / 2 - 4;

  // Sorted big-to-small and laid on a ring whose radius follows the largest
  // child, so the same input always packs the same way.
  const sorted = [...kids].sort((a, b) => total(b) - total(a));
  const rOf = (v: number) => Math.sqrt(v / grand) * R * 0.92;
  const ring = R - rOf(total(sorted[0]));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }}
      role="img" aria-label={label ?? `${kids.length} groups by size`}>
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--border)" />
      {sorted.map((k, i) => {
        const a = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
        const cx = size / 2 + Math.cos(a) * ring * 0.62;
        const cy = size / 2 + Math.sin(a) * ring * 0.62;
        const r = rOf(total(k));
        return (
          <g key={k.name}>
            <circle cx={cx} cy={cy} r={r} fill={SHADE(i, sorted.length)}>
              <title>{`${k.name}: ${total(k)}`}</title>
            </circle>
            {(k.children ?? []).map((c, ci) => {
              const ca = (ci / (k.children?.length || 1)) * Math.PI * 2;
              const cr = Math.sqrt(total(c) / (total(k) || 1)) * r * 0.5;
              return <circle key={c.name} cx={cx + Math.cos(ca) * r * 0.42} cy={cy + Math.sin(ca) * r * 0.42}
                r={cr} fill="var(--background)" fillOpacity={0.55}><title>{`${c.name}: ${total(c)}`}</title></circle>;
            })}
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(11, r / 2.2)}
              className="fill-background">{k.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------- nested proportional area */
/** Squares of the same centre, area to scale — one figure inside another. */
export function NestedArea({
  items, size = 220, format = (n: number) => String(n), label,
}: {
  items: { label: string; value: number }[]; size?: number; format?: (n: number) => string; label?: string;
}) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const hi = sorted[0].value || 1;

  return (
    <div className="flex items-end gap-4" role="img" aria-label={label ?? sorted.map((i) => `${i.label} ${format(i.value)}`).join(", ")}>
      <div className="relative" style={{ width: size, height: size }}>
        {sorted.map((it, i) => {
          const s = Math.sqrt(it.value / hi) * size;
          return (
            <div key={it.label} className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[2px] border"
              style={{ width: s, height: s, borderColor: TONE, background: SHADE(i, sorted.length), zIndex: i }}
              title={`${it.label}: ${format(it.value)}`} />
          );
        })}
      </div>
      <div className="space-y-1">
        {sorted.map((it, i) => (
          <div key={it.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: SHADE(i, sorted.length) }} />
            {it.label} <span className="tabular-nums">{format(it.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- icicle */
/** A sunburst unrolled: hierarchy top-down, width to scale. Easier to label. */
export function Icicle({ root, height = 220, label }: { root: TreeNode; height?: number; label?: string }) {
  const grand = total(root) || 1;
  const depth = (n: TreeNode): number => 1 + Math.max(0, ...(n.children ?? []).map(depth));
  const levels = depth(root);
  const rowH = height / levels;

  const boxes: { name: string; x: number; w: number; d: number; v: number }[] = [];
  const walk = (n: TreeNode, x: number, w: number, d: number) => {
    boxes.push({ name: n.name, x, w, d, v: total(n) });
    let cx = x;
    for (const c of n.children ?? []) {
      const cw = (total(c) / (total(n) || 1)) * w;
      walk(c, cx, cw, d + 1);
      cx += cw;
    }
  };
  walk(root, 0, 100, 0);

  return (
    <div className="relative w-full" style={{ height }} role="img" aria-label={label ?? `Hierarchy of ${grand}`}>
      {boxes.map((b, i) => (
        <div key={`${b.name}-${i}`}
          className="absolute overflow-hidden rounded-[2px] border border-background px-1 text-[10px] leading-none"
          style={{
            left: `${b.x}%`, width: `${b.w}%`, top: b.d * rowH, height: rowH - 2,
            background: SHADE(b.d, levels), color: b.d < 2 ? "var(--background)" : "var(--foreground)",
            display: "flex", alignItems: "center",
          }}
          title={`${b.name}: ${b.v}`}>
          {b.w > 6 ? b.name : ""}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- arc diagram */
/** Nodes on a line, relationships as arcs above it. Legible where a network isn't. */
export function ArcDiagram({
  nodes, links, width = 420, height = 160, label,
}: {
  nodes: { id: string; weight?: number }[];
  links: { source: string; target: string; value?: number }[];
  width?: number; height?: number; label?: string;
}) {
  if (!nodes.length) return null;
  const y = height - 26;
  const X = (i: number) => 18 + (i / (nodes.length - 1 || 1)) * (width - 36);
  const at = (id: string) => nodes.findIndex((n) => n.id === id);
  const maxV = Math.max(1, ...links.map((l) => l.value ?? 1));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${nodes.length} nodes, ${links.length} links`}>
      {links.map((l, i) => {
        const a = at(l.source), b = at(l.target);
        if (a < 0 || b < 0) return null;
        const x1 = X(a), x2 = X(b);
        const r = Math.abs(x2 - x1) / 2;
        return (
          <path key={i} d={`M ${Math.min(x1, x2)} ${y} A ${r} ${Math.min(r, y - 6)} 0 0 1 ${Math.max(x1, x2)} ${y}`}
            fill="none" stroke={TONE} strokeOpacity={0.28} strokeWidth={0.6 + ((l.value ?? 1) / maxV) * 2.4}>
            <title>{`${l.source} – ${l.target}`}</title>
          </path>
        );
      })}
      <line x1={12} x2={width - 12} y1={y} y2={y} stroke="var(--border)" />
      {nodes.map((n, i) => (
        <g key={n.id}>
          <circle cx={X(i)} cy={y} r={3 + (n.weight ?? 1) * 0.3} fill={TONE} />
          <text x={X(i)} y={y + 15} textAnchor="middle" fontSize={9} className="fill-muted-foreground">{n.id}</text>
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------- alluvial */
/**
 * Categories flowing through ordered stages — how a cohort re-sorts itself.
 * Distinct from sankey: the same set of things appears at EVERY stage.
 */
export function Alluvial({
  stages, flows, width = 460, height = 240, label,
}: {
  stages: { label: string; nodes: { id: string; value: number }[] }[];
  flows: { from: string; to: string; value: number; stage: number }[];
  width?: number; height?: number; label?: string;
}) {
  if (stages.length < 2) return null;
  const colW = 14;
  const gapY = 6;
  const X = (s: number) => (s / (stages.length - 1)) * (width - colW);

  const pos = stages.map((st) => {
    const sum = st.nodes.reduce((s, n) => s + n.value, 0) || 1;
    const usable = height - gapY * (st.nodes.length - 1);
    let y = 0;
    return st.nodes.map((n) => {
      const h = (n.value / sum) * usable;
      const box = { id: n.id, y, h };
      y += h + gapY;
      return box;
    });
  });
  const find = (s: number, id: string) => pos[s]?.find((p) => p.id === id);

  const used = pos.map((col) => col.map((b) => ({ id: b.id, out: b.y, in: b.y })));
  const take = (s: number, id: string, side: "out" | "in", amount: number, colSum: number) => {
    const col = used[s].find((u) => u.id === id);
    const box = find(s, id);
    if (!col || !box) return { y: 0, h: 0 };
    const h = (amount / colSum) * box.h;
    const y = col[side];
    col[side] += h;
    return { y, h };
  };

  return (
    <svg viewBox={`0 0 ${width} ${height + 16}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `Flow across ${stages.length} stages`}>
      {flows.map((f, i) => {
        const s = f.stage;
        const fromTotal = stages[s].nodes.find((n) => n.id === f.from)?.value || 1;
        const toTotal = stages[s + 1]?.nodes.find((n) => n.id === f.to)?.value || 1;
        const a = take(s, f.from, "out", f.value, fromTotal);
        const b = take(s + 1, f.to, "in", f.value, toTotal);
        const x1 = X(s) + colW, x2 = X(s + 1);
        const mx = (x1 + x2) / 2;
        return (
          <path key={i}
            d={`M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y} L ${x2} ${b.y + b.h} C ${mx} ${b.y + b.h}, ${mx} ${a.y + a.h}, ${x1} ${a.y + a.h} Z`}
            fill={TONE} fillOpacity={0.16}>
            <title>{`${f.from} → ${f.to}: ${f.value}`}</title>
          </path>
        );
      })}
      {pos.map((col, s) =>
        col.map((b) => (
          <g key={`${s}-${b.id}`}>
            <rect x={X(s)} y={b.y} width={colW} height={Math.max(1, b.h)} fill={TONE} rx={2}>
              <title>{b.id}</title>
            </rect>
            <text x={X(s) + (s === stages.length - 1 ? -4 : colW + 4)} y={b.y + b.h / 2}
              textAnchor={s === stages.length - 1 ? "end" : "start"} dominantBaseline="middle"
              fontSize={9} className="fill-muted-foreground">{b.id}</text>
          </g>
        ))
      )}
      {stages.map((st, s) => (
        <text key={st.label} x={X(s) + colW / 2} y={height + 12} textAnchor="middle" fontSize={9}
          className="fill-muted-foreground">{st.label}</text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------ dendrogram */
/** A tree drawn with elbow connectors — leaves aligned so labels line up. */
export function Dendrogram({ root, width = 380, rowHeight = 26, label }: { root: TreeNode; width?: number; rowHeight?: number; label?: string }) {
  const leaves: TreeNode[] = [];
  const collect = (n: TreeNode) => { if (!n.children?.length) leaves.push(n); else n.children.forEach(collect); };
  collect(root);
  if (!leaves.length) return null;

  const depthOf = (n: TreeNode): number => 1 + Math.max(0, ...(n.children ?? []).map(depthOf));
  const levels = depthOf(root);
  const height = leaves.length * rowHeight;
  const colW = (width - 90) / Math.max(1, levels - 1);

  let cursor = 0;
  const yOf = new Map<TreeNode, number>();
  const place = (n: TreeNode): number => {
    if (!n.children?.length) { const y = cursor * rowHeight + rowHeight / 2; cursor++; yOf.set(n, y); return y; }
    const ys = n.children.map(place);
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    yOf.set(n, y);
    return y;
  };
  place(root);

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const walk = (n: TreeNode, d: number) => {
    for (const c of n.children ?? []) {
      const x1 = d * colW, x2 = (d + 1) * colW;
      const y1 = yOf.get(n)!, y2 = yOf.get(c)!;
      edges.push({ x1, y1, x2: x1, y2 });
      edges.push({ x1, y1: y2, x2, y2 });
      walk(c, d + 1);
    }
  };
  walk(root, 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `Tree with ${leaves.length} leaves`}>
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--border)" strokeWidth={1.2} />
      ))}
      {[...yOf.entries()].map(([n, y], i) => {
        const isLeaf = !n.children?.length;
        const d = isLeaf ? levels - 1 : 0;
        void d;
        return isLeaf ? (
          <text key={i} x={(levels - 1) * colW + 6} y={y} dominantBaseline="middle" fontSize={10} className="fill-foreground">
            {n.name}
          </text>
        ) : null;
      })}
    </svg>
  );
}

/* -------------------------------------------------------------- org chart */
/** Boxes and connectors, top-down. Two levels deep, which is most small teams. */
export function OrgChart({ root, label }: { root: TreeNode; label?: string }) {
  const kids = root.children ?? [];
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `Structure under ${root.name}`}>
      <div className="flex min-w-max flex-col items-center gap-0 px-2">
        <div className="rounded-[4px] px-3 py-1.5 text-[11px] font-medium" style={{ background: TONE, color: "var(--background)" }}>
          {root.name}
        </div>
        {kids.length ? <div className="h-4 w-px bg-border" /> : null}
        {kids.length ? <div className="h-px bg-border" style={{ width: `${(kids.length - 1) * 140 + 2}px` }} /> : null}
        <div className="flex gap-4">
          {kids.map((k) => (
            <div key={k.name} className="flex w-[124px] flex-col items-center">
              <div className="h-4 w-px bg-border" />
              <div className="w-full truncate rounded-[4px] border px-2 py-1 text-center text-[10px]"
                style={{ borderColor: TONE }}>{k.name}</div>
              {(k.children ?? []).map((c) => (
                <div key={c.name} className="mt-1 w-full truncate rounded-[3px] px-2 py-1 text-center text-[10px] text-muted-foreground"
                  style={{ background: "var(--muted)" }}>{c.name}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- adjacency matrix */
/**
 * The relationships behind a network, as a grid. No overlapping edges, so it
 * stays readable exactly where a node-link diagram turns into spaghetti.
 */
export function AdjacencyMatrix({
  labels, matrix, cell = 24, label,
}: {
  labels: string[]; matrix: number[][]; cell?: number; label?: string;
}) {
  if (!labels.length) return null;
  const hi = Math.max(...matrix.flat()) || 1;
  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${labels.length} by ${labels.length} relationships`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {labels.map((l) => (
              <th key={l} className="pb-1 text-[9px] font-normal text-muted-foreground" style={{ width: cell }}>{l.slice(0, 4)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[9px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {labels.map((c, ci) => {
                const v = matrix[ri]?.[ci] ?? 0;
                return (
                  <td key={c} className="p-0">
                    <div className="rounded-[2px]" style={{
                      width: cell, height: cell,
                      // The diagonal is a thing's relationship with itself and
                      // is meaningless here — hatched out rather than left to
                      // read as "no relationship".
                      background: ri === ci ? "var(--muted)" : `color-mix(in oklch, var(--foreground) ${Math.round((v / hi) * 92)}%, var(--muted))`,
                      opacity: ri === ci ? 0.4 : 1,
                    }} title={ri === ci ? `${r}` : `${r} → ${c}: ${v}`} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
