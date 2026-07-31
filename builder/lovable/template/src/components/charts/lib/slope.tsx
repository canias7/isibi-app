/**
 * Two points in time, one line each — a slope graph.
 *
 * Better than a grouped bar chart for "what changed between then and now",
 * because the direction and steepness of the line IS the answer, where two bars
 * make the reader do the subtraction.
 *
 * Rise and fall are distinguished by line weight and by the arrow in the label,
 * never by colour alone.
 */
export type Slope = { label: string; from: number; to: number; emphasise?: boolean };

export function SlopeChart({
  items,
  fromLabel = "Before",
  toLabel = "After",
  height = 240,
  format = (n: number) => String(n),
  showValues = true,
  sortBy = "to",
  invert = false,
  label,
}: {
  items: Slope[];
  fromLabel?: string;
  toLabel?: string;
  height?: number;
  format?: (n: number) => string;
  showValues?: boolean;
  sortBy?: "to" | "from" | "change" | "none";
  /** Put the LOWEST value at the top. For ranks, where 1 is best. */
  invert?: boolean;
  label?: string;
}) {
  if (!items.length) return null;

  const rows = sortBy === "none" ? items : [...items].sort((a, b) =>
    sortBy === "change" ? (b.to - b.from) - (a.to - a.from) : sortBy === "from" ? b.from - a.from : b.to - a.to
  );

  const all = rows.flatMap((r) => [r.from, r.to]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const y = (v: number) => (invert ? (v - lo) / span : (hi - v) / span) * 100;

  // Labels are nudged apart so close values stay readable. Without this a
  // cluster like 139/122/96/64 prints four labels on top of each other and the
  // chart is unreadable exactly where it is most interesting. The LINES keep
  // their true positions — only the text moves.
  const spread = (vals: number[], minGap: number) => {
    const order = vals.map((v, i) => ({ i, y: y(v) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < order.length; k++) {
      if (order[k].y - order[k - 1].y < minGap) order[k].y = order[k - 1].y + minGap;
    }
    // A run pushed past the bottom is walked back up, or the last labels sit
    // outside the plot area entirely.
    const overflow = order.length ? order[order.length - 1].y - 100 : 0;
    if (overflow > 0) for (const o of order) o.y = Math.max(0, o.y - overflow);
    const out: number[] = [];
    for (const o of order) out[o.i] = o.y;
    return out;
  };

  // A two-line label needs more room than a one-line one.
  const gap = showValues ? (24 / height) * 100 : (13 / height) * 100;
  const leftY = spread(rows.map((r) => r.from), gap);
  const rightY = spread(rows.map((r) => r.to), gap);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${rows.length} series between ${fromLabel} and ${toLabel}`}>
      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
      <div className="relative w-full" style={{ height }}>
        <div className="absolute top-0 bottom-0 left-[22%] border-l border-border" />
        <div className="absolute top-0 right-[22%] bottom-0 border-l border-border" />
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {rows.map((r) => (
            <line key={r.label} x1={22} y1={y(r.from)} x2={78} y2={y(r.to)}
              stroke="var(--foreground)" vectorEffect="non-scaling-stroke"
              strokeWidth={r.emphasise ? 2.5 : 1} strokeOpacity={r.emphasise ? 1 : 0.45} />
          ))}
        </svg>
        {rows.map((r, i) => {
          const up = r.to >= r.from;
          return (
            <div key={`${r.label}-labels`}>
              <div className="absolute -translate-y-1/2 pr-2 text-right text-[10px] leading-tight text-muted-foreground"
                style={{ top: `${leftY[i]}%`, right: "79%", maxWidth: "20%" }}>
                <span className="block truncate">{r.label}</span>
                {showValues ? <span className="tabular-nums">{format(r.from)}</span> : null}
              </div>
              <div className="absolute -translate-y-1/2 pl-2 text-[10px] leading-tight"
                style={{ top: `${rightY[i]}%`, left: "79%", maxWidth: "20%" }}>
                <span className={`block truncate ${r.emphasise ? "font-medium" : "text-muted-foreground"}`}>
                  {up ? "↑" : "↓"} {r.label}
                </span>
                {showValues ? <span className="tabular-nums text-muted-foreground">{format(r.to)}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const SERVICE_SLOPES: Slope[] = [
  { label: "Cuts", from: 412, to: 468 },
  { label: "Beard", from: 266, to: 231 },
  { label: "Colour", from: 96, to: 184, emphasise: true },
  { label: "Towel", from: 139, to: 122 },
  { label: "Kids", from: 64, to: 88 },
];
