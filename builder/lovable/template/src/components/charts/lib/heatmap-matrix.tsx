/**
 * A two-dimensional grid of intensity — hour against weekday is the one a
 * business actually asks for ("when are we busy?").
 *
 * Bucketed into five steps rather than a continuous ramp, for the same reason
 * `calendar-heatmap` is: a continuous scale invites reading a difference
 * between two cells that the eye cannot actually resolve.
 */
export function HeatmapMatrix({
  rows,
  cols,
  values,
  cell = 26,
  gap = 2,
  levels,
  format = (n: number) => String(n),
  showValues = false,
  label,
}: {
  rows: string[];
  cols: string[];
  /** values[rowIndex][colIndex] */
  values: number[][];
  cell?: number;
  gap?: number;
  levels?: [string, string, string, string, string];
  format?: (n: number) => string;
  showValues?: boolean;
  label?: string;
}) {
  if (!rows.length || !cols.length) return null;

  const ramp = levels ?? ([
    "var(--muted)",
    "color-mix(in oklch, var(--foreground) 18%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 38%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 62%, var(--muted))",
    "var(--foreground)",
  ] as [string, string, string, string, string]);

  const flat = values.flat();
  const hi = Math.max(...flat) || 1;
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.floor((v / hi) * 3.999) + 1));

  return (
    <div className="w-full overflow-x-auto" role="img"
      aria-label={label ?? `${rows.length} by ${cols.length} grid, peak ${format(hi)}`}>
      <table className="border-separate" style={{ borderSpacing: gap }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="pb-1 text-[10px] font-normal text-muted-foreground" style={{ width: cell }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{r}</th>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                return (
                  <td key={c} className="p-0">
                    <div
                      className="flex items-center justify-center rounded-[3px] text-[9px] tabular-nums"
                      style={{
                        width: cell,
                        height: cell,
                        background: ramp[level(v)],
                        // Above the midpoint the cell is dark, so the label has
                        // to flip or it disappears into its own background.
                        color: level(v) >= 3 ? "var(--background)" : "var(--foreground)",
                      }}
                      title={`${r} · ${c}: ${format(v)}`}
                    >
                      {showValues ? format(v) : ""}
                    </div>
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

/** Deterministic busyness grid: quiet mornings, busy Friday and Saturday. */
export function sampleMatrix(rows: number, cols: number, seed = 3): number[][] {
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 1000) / 1000; };
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const midday = 1 - Math.abs(r - rows * 0.6) / rows;
      const weekend = c >= cols - 3 ? 1.3 : 0.8;
      return Math.max(0, Math.round(next() * 6 * midday * weekend * 2));
    })
  );
}
