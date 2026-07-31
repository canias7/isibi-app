/** Sets, logic and process-structure diagrams. */

const TONE = "var(--foreground)";

/* ---------------------------------------------------------------------- venn */
/** Two or three overlapping sets with their counts placed. */
export function VennDiagram({
  sets, overlaps, size = 270, label,
}: {
  sets: { label: string; count: number }[];
  /** Keyed "0&1", "0&2", "1&2", "0&1&2". */ overlaps: Record<string, number>;
  size?: number; label?: string;
}) {
  const n = Math.min(sets.length, 3);
  if (n < 2) return null;
  const R = 26;
  const centres = n === 2
    ? [{ x: 38, y: 50 }, { x: 62, y: 50 }]
    : [{ x: 38, y: 42 }, { x: 62, y: 42 }, { x: 50, y: 64 }];
  const mid = (a: number, b: number) => ({ x: (centres[a].x + centres[b].x) / 2, y: (centres[a].y + centres[b].y) / 2 });

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? sets.map((s) => `${s.label} ${s.count}`).join(", ")}>
        {centres.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={R} fill={TONE} fillOpacity={0.1} stroke={TONE} strokeWidth={1.2} />
        ))}
        {centres.map((c, i) => {
          // The exclusive count sits pushed AWAY from the shared middle, or
          // every number ends up in the overlap it does not describe. The set
          // NAME sits just outside the circle on the same outward ray — the
          // first draft computed a clever dy and placed all three off-canvas.
          const away = { x: c.x + (c.x - 50) * 0.5, y: c.y + (c.y - 50) * 0.5 };
          const len = Math.hypot(c.x - 50, c.y - 50) || 1;
          const name = { x: 50 + ((c.x - 50) / len) * (len + R + 5), y: 50 + ((c.y - 50) / len) * (len + R + 5) };
          return (
            <g key={`t-${i}`}>
              <text x={away.x} y={away.y} textAnchor="middle" fontSize={8} fontWeight={600} className="fill-foreground">{sets[i].count}</text>
              <text x={name.x} y={name.y} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} className="fill-muted-foreground">{sets[i].label}</text>
            </g>
          );
        })}
        {n >= 2 && overlaps["0&1"] !== undefined ? (
          <text {...mid(0, 1)} dy={n === 3 ? -2 : 3} textAnchor="middle" fontSize={7.5} className="fill-foreground">{overlaps["0&1"]}</text>
        ) : null}
        {n === 3 ? (
          <>
            {overlaps["0&2"] !== undefined ? <text x={(centres[0].x + centres[2].x) / 2 - 2} y={(centres[0].y + centres[2].y) / 2 + 2} textAnchor="middle" fontSize={7.5} className="fill-foreground">{overlaps["0&2"]}</text> : null}
            {overlaps["1&2"] !== undefined ? <text x={(centres[1].x + centres[2].x) / 2 + 2} y={(centres[1].y + centres[2].y) / 2 + 2} textAnchor="middle" fontSize={7.5} className="fill-foreground">{overlaps["1&2"]}</text> : null}
            {overlaps["0&1&2"] !== undefined ? <text x={50} y={51} textAnchor="middle" fontSize={7.5} fontWeight={600} className="fill-foreground">{overlaps["0&1&2"]}</text> : null}
          </>
        ) : null}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Counts are exclusive to each region</p>
    </div>
  );
}

/* --------------------------------------------------------------- UpSet plot */
/**
 * Set intersections done properly: a dot matrix names each combination, a bar
 * gives its size. This is what replaces a Venn the moment there are four or
 * more sets — a 4-set Venn is unreadable and a 5-set one is a lie.
 */
export function UpSetPlot({
  sets, intersections, barHeight = 110, cell = 18, label,
}: {
  sets: { label: string; size: number }[];
  intersections: { members: number[]; size: number }[];
  barHeight?: number; cell?: number; label?: string;
}) {
  if (!sets.length || !intersections.length) return null;
  const combos = [...intersections].sort((a, b) => b.size - a.size);
  const hi = combos[0].size || 1;
  const setHi = Math.max(...sets.map((s) => s.size)) || 1;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${combos.length} intersections across ${sets.length} sets`}>
      <div className="flex">
        <div style={{ width: 120 }} className="shrink-0" />
        <div className="flex items-end" style={{ height: barHeight, gap: 4 }}>
          {combos.map((c, i) => (
            <div key={i} className="flex flex-col items-center justify-end" style={{ width: cell }}>
              <span className="mb-0.5 text-[8px] tabular-nums text-muted-foreground">{c.size}</span>
              <div className="w-3 rounded-t-[2px]" style={{ height: (c.size / hi) * (barHeight - 18), background: TONE }} />
            </div>
          ))}
        </div>
      </div>
      {sets.map((s, si) => (
        <div key={s.label} className="flex items-center">
          <div className="flex shrink-0 items-center justify-end gap-1 pr-2" style={{ width: 120 }}>
            <span className="truncate text-[9px] text-muted-foreground">{s.label}</span>
            <div className="h-2 rounded-[1px]" style={{ width: (s.size / setHi) * 34, background: TONE, opacity: 0.4 }} />
          </div>
          <div className="flex" style={{ gap: 4 }}>
            {combos.map((c, ci) => {
              const on = c.members.includes(si);
              return (
                <div key={ci} className="flex items-center justify-center" style={{ width: cell, height: cell }}>
                  <span className="rounded-full" style={{ width: 8, height: 8, background: on ? TONE : "var(--muted)" }} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="mt-1 text-[10px] text-muted-foreground">Filled dots name each combination · bars are how many fall in exactly that one</p>
    </div>
  );
}

/* ------------------------------------------------------------ fourfold plot */
/** A 2×2 table as quarter-circles, radius by the square root of the count. */
export function FourfoldPlot({
  labels, counts, size = 250, label,
}: {
  labels: { rows: [string, string] | string[]; cols: [string, string] | string[] };
  /** [[a,b],[c,d]] row-major. */ counts: number[][]; size?: number; label?: string;
}) {
  if (counts.length !== 2) return null;
  const hi = Math.max(...counts.flat()) || 1;
  const R = 34;
  const r = (v: number) => Math.sqrt(v / hi) * R;
  const quads = [
    { v: counts[0][0], sx: -1, sy: -1 }, { v: counts[0][1], sx: 1, sy: -1 },
    { v: counts[1][0], sx: -1, sy: 1 }, { v: counts[1][1], sx: 1, sy: 1 },
  ];
  // Odds ratio computed here rather than passed, like every derived number.
  const or = (counts[0][0] * counts[1][1]) / ((counts[0][1] * counts[1][0]) || 1);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `Odds ratio ${or.toFixed(2)}`}>
        <line x1={50} y1={6} x2={50} y2={94} stroke="var(--border)" />
        <line x1={6} y1={50} x2={94} y2={50} stroke="var(--border)" />
        {quads.map((q, i) => {
          const rad = r(q.v);
          return (
            <path key={i}
              d={`M 50 50 L ${50 + q.sx * rad} 50 A ${rad} ${rad} 0 0 ${q.sx * q.sy > 0 ? 1 : 0} 50 ${50 + q.sy * rad} Z`}
              fill={TONE} fillOpacity={0.22} stroke={TONE} strokeWidth={1} />
          );
        })}
        {quads.map((q, i) => (
          <text key={`t-${i}`} x={50 + q.sx * (R + 6)} y={50 + q.sy * (R + 6)} textAnchor="middle" dominantBaseline="middle"
            fontSize={7.5} className="fill-foreground">{q.v}</text>
        ))}
        <text x={28} y={5.5} textAnchor="middle" fontSize={6.5} className="fill-muted-foreground">{labels.cols[0]}</text>
        <text x={72} y={5.5} textAnchor="middle" fontSize={6.5} className="fill-muted-foreground">{labels.cols[1]}</text>
        <text x={3} y={30} fontSize={6.5} className="fill-muted-foreground" transform="rotate(-90 4 30)" textAnchor="middle">{labels.rows[0]}</text>
        <text x={3} y={72} fontSize={6.5} className="fill-muted-foreground" transform="rotate(-90 4 72)" textAnchor="middle">{labels.rows[1]}</text>
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Quarter area is the count · odds ratio {or.toFixed(2)}</p>
    </div>
  );
}

/* -------------------------------------------------------- probability tree */
/**
 * Two levels of branching with the leaf probabilities MULTIPLIED OUT.
 *
 * The multiplication is where every hand-drawn tree goes wrong, so the leaves
 * are computed from the branches rather than accepted as props.
 */
export function ProbabilityTree({
  root, rowHeight = 30, label,
}: {
  root: { branches: { label: string; p: number; branches?: { label: string; p: number }[] }[] };
  rowHeight?: number; label?: string;
}) {
  const leaves: { path: string[]; p: number }[] = [];
  for (const b of root.branches) {
    if (b.branches?.length) for (const c of b.branches) leaves.push({ path: [b.label, c.label], p: b.p * c.p });
    else leaves.push({ path: [b.label], p: b.p });
  }
  const H = leaves.length * rowHeight;
  let cursor = 0;
  const spans = root.branches.map((b) => {
    const k = b.branches?.length || 1;
    const from = cursor;
    cursor += k;
    return { b, from, k };
  });
  const yAt = (i: number) => i * rowHeight + rowHeight / 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${leaves.length} outcomes`}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
        {spans.map(({ b, from, k }) => {
          const midY = yAt(from + (k - 1) / 2);
          return (
            <g key={b.label}>
              <line x1={4} y1={H / 2} x2={30} y2={midY} stroke={TONE} strokeWidth={1 + b.p * 2.4} strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
              {(b.branches ?? []).map((c, ci) => (
                <line key={c.label} x1={30} y1={midY} x2={62} y2={yAt(from + ci)} stroke={TONE} strokeWidth={1 + c.p * 2.4} strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          );
        })}
        <circle cx={4} cy={H / 2} r={2.4} fill={TONE} />
        {spans.map(({ b, from, k }) => (
          <circle key={`n-${b.label}`} cx={30} cy={yAt(from + (k - 1) / 2)} r={2} fill={TONE} />
        ))}
      </svg>
      <div className="pointer-events-none relative" style={{ height: 0 }}>
        {spans.map(({ b, from, k }) => (
          <span key={b.label} className="absolute text-[9px] font-medium"
            style={{ left: "26%", top: yAt(from + (k - 1) / 2) - H - 16, transform: "translateX(-50%)" }}>
            {b.label} <span className="font-normal text-muted-foreground">{b.p}</span>
          </span>
        ))}
        {leaves.map((l, i) => (
          <span key={i} className="absolute text-[9px]"
            style={{ left: "64%", top: yAt(i) - H - 7 }}>
            {l.path[l.path.length - 1]}
            <span className="ml-2 tabular-nums text-muted-foreground">= {l.p.toFixed(3)}</span>
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" style={{ marginTop: 4 }}>
        Leaf probabilities are the branch products, computed — they sum to {leaves.reduce((s, l) => s + l.p, 0).toFixed(2)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ state diagram */
/** States on a ring, transitions as labelled arrows. */
export function StateDiagram({
  states, transitions, size = 290, label,
}: {
  states: string[]; transitions: { from: string; to: string; label?: string }[];
  size?: number; label?: string;
}) {
  if (!states.length) return null;
  const cx = 50, cy = 50, R = 36;
  const pos = new Map(states.map((s, i) => {
    const a = (i / states.length) * Math.PI * 2 - Math.PI / 2;
    return [s, { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }];
  }));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${states.length} states, ${transitions.length} transitions`}>
        <defs>
          <marker id="sd-arrow" viewBox="0 0 6 6" refX={5.4} refY={3} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill={TONE} />
          </marker>
        </defs>
        {transitions.map((t, i) => {
          const a = pos.get(t.from), b = pos.get(t.to);
          if (!a || !b) return null;
          if (t.from === t.to) {
            const out = { x: (a.x - cx) / R, y: (a.y - cy) / R };
            return (
              <g key={i}>
                <path d={`M ${a.x + out.x * 6} ${a.y + out.y * 6} A 5 5 0 1 1 ${a.x + out.x * 6 + out.y * 4} ${a.y + out.y * 6 - out.x * 4}`}
                  fill="none" stroke={TONE} strokeWidth={0.9} markerEnd="url(#sd-arrow)" />
                {t.label ? <text x={a.x + out.x * 15} y={a.y + out.y * 15} textAnchor="middle" fontSize={5.5} className="fill-muted-foreground">{t.label}</text> : null}
              </g>
            );
          }
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const sx = a.x + ux * 7.5, sy = a.y + uy * 7.5;
          const ex = b.x - ux * 7.5, ey = b.y - uy * 7.5;
          const mx = (sx + ex) / 2 - uy * 6, my = (sy + ey) / 2 + ux * 6;
          return (
            <g key={i}>
              <path d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={TONE} strokeWidth={0.9} markerEnd="url(#sd-arrow)" />
              {t.label ? <text x={mx} y={my} textAnchor="middle" fontSize={5.5} className="fill-muted-foreground">{t.label}</text> : null}
            </g>
          );
        })}
        {states.map((s) => {
          const p = pos.get(s)!;
          return (
            <g key={s}>
              <circle cx={p.x} cy={p.y} r={7} fill="var(--background)" stroke={TONE} strokeWidth={1.2} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={5.2} className="fill-foreground">{s}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
