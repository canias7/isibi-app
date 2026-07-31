/**
 * A distribution: values binned, then counted.
 *
 * The binning is the component. Recharts can draw the bars, but nothing in it
 * bins, so every "histogram" built on BarChart is really a bar chart of data
 * the page had to bucket by hand — which is where the off-by-one lives.
 *
 * Bars touch, because a histogram's x-axis is continuous. A bar chart's gaps
 * say "these categories are separate"; here they would be a lie.
 */
export function Histogram({
  values,
  bins = 12,
  min,
  max,
  height = 200,
  format = (n: number) => String(Math.round(n)),
  showAxis = true,
  showCounts = false,
  markMean = false,
  label,
}: {
  values: number[];
  bins?: number;
  min?: number;
  max?: number;
  height?: number;
  format?: (n: number) => string;
  showAxis?: boolean;
  showCounts?: boolean;
  markMean?: boolean;
  label?: string;
}) {
  if (!values.length) return null;

  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const width = span / bins;

  const counts = Array(bins).fill(0) as number[];
  for (const v of values) {
    if (v < lo || v > hi) continue;
    // The top edge belongs to the LAST bin rather than opening a bin+1 that
    // holds exactly one value — the classic off-by-one in hand-rolled binning.
    const i = v === hi ? bins - 1 : Math.floor((v - lo) / width);
    counts[i]++;
  }

  const peak = Math.max(...counts) || 1;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;

  return (
    <div className="w-full" role="img"
      aria-label={label ?? `Distribution of ${values.length} values from ${format(lo)} to ${format(hi)}`}>
      <div className="relative flex w-full items-end" style={{ height }}>
        {counts.map((c, i) => (
          <div key={i} className="relative flex-1" style={{ height: "100%" }}>
            <div
              className="absolute right-0 bottom-0 left-0 bg-foreground"
              style={{ height: `${(c / peak) * 100}%`, opacity: 0.85 }}
              title={`${format(lo + i * width)}–${format(lo + (i + 1) * width)}: ${c}`}
            />
            {showCounts && c > 0 ? (
              <div className="absolute right-0 left-0 text-center text-[9px] tabular-nums text-muted-foreground"
                style={{ bottom: `calc(${(c / peak) * 100}% + 2px)` }}>
                {c}
              </div>
            ) : null}
          </div>
        ))}
        {markMean ? (
          <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground"
            style={{ left: `${((mean - lo) / span) * 100}%` }} title={`Mean ${format(mean)}`} />
        ) : null}
      </div>
      {showAxis ? (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{format(lo)}</span>
          <span>{format(lo + span / 2)}</span>
          <span>{format(hi)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Deterministic roughly-normal sample, so every build renders identically. */
export function sampleValues(n: number, centre = 40, spread = 14, seed = 5): number[] {
  const out: number[] = [];
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 1000) / 1000; };
  for (let i = 0; i < n; i++) {
    // Sum of three uniforms — a cheap bell without needing a Gaussian.
    const g = (next() + next() + next()) / 3 - 0.5;
    out.push(Math.max(0, Math.round(centre + g * spread * 4)));
  }
  return out;
}
