/**
 * A tile-grid cartogram — the newsroom grid map.
 *
 * NOT a true geographic choropleth, deliberately. A real one needs boundary
 * polygons: either a mapping dependency, or 100 KB+ of GeoJSON embedded in
 * every generated site's bundle for a chart most of them will never use. It
 * also inherits the problem `location-card` already refuses — a tile provider
 * that bills per load and drops a third-party tracker on a small business.
 *
 * The grid trades exact shape for the thing a choropleth is usually read for:
 * comparing regions. It is arguably better at that, because a grid gives every
 * region equal visual weight instead of letting the largest one dominate.
 */
export type Region = { id: string; name?: string; row: number; col: number; value: number };

export function Choropleth({
  regions,
  cell = 40,
  gap = 4,
  levels,
  format = (n: number) => String(n),
  showValues = false,
  showLegend = true,
  label,
}: {
  regions: Region[];
  cell?: number;
  gap?: number;
  levels?: [string, string, string, string, string];
  format?: (n: number) => string;
  showValues?: boolean;
  showLegend?: boolean;
  label?: string;
}) {
  if (!regions.length) return null;

  const ramp = levels ?? ([
    "var(--muted)",
    "color-mix(in oklch, var(--foreground) 18%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 38%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 62%, var(--muted))",
    "var(--foreground)",
  ] as [string, string, string, string, string]);

  const hi = Math.max(...regions.map((r) => r.value)) || 1;
  const lo = Math.min(...regions.map((r) => r.value));
  const level = (v: number) => Math.min(4, Math.floor(((v - lo) / (hi - lo || 1)) * 4.999));

  const rows = Math.max(...regions.map((r) => r.row)) + 1;
  const cols = Math.max(...regions.map((r) => r.col)) + 1;
  const step = cell + gap;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${regions.length} regions, ${format(lo)} to ${format(hi)}`}>
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: cols * step, height: rows * step }}>
          {regions.map((r) => (
            <div
              key={r.id}
              className="absolute flex flex-col items-center justify-center rounded-[3px] leading-none"
              style={{
                left: r.col * step,
                top: r.row * step,
                width: cell,
                height: cell,
                background: ramp[level(r.value)],
                color: level(r.value) >= 3 ? "var(--background)" : "var(--foreground)",
              }}
              title={`${r.name ?? r.id}: ${format(r.value)}`}
            >
              <span className="text-[10px] font-medium">{r.id}</span>
              {showValues ? <span className="mt-0.5 text-[8px] tabular-nums opacity-80">{format(r.value)}</span> : null}
            </div>
          ))}
        </div>
      </div>
      {showLegend ? (
        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{format(lo)}</span>
          {ramp.map((c) => <span key={c} className="h-3 w-6 rounded-[2px]" style={{ background: c }} />)}
          <span>{format(hi)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** UK nations and English regions, laid out roughly geographically. */
export const UK_GRID: Omit<Region, "value">[] = [
  { id: "SCO", name: "Scotland", row: 0, col: 2 },
  { id: "NI", name: "Northern Ireland", row: 1, col: 0 },
  { id: "NE", name: "North East", row: 1, col: 3 },
  { id: "NW", name: "North West", row: 2, col: 2 },
  { id: "YH", name: "Yorkshire & Humber", row: 2, col: 3 },
  { id: "WAL", name: "Wales", row: 3, col: 1 },
  { id: "WM", name: "West Midlands", row: 3, col: 2 },
  { id: "EM", name: "East Midlands", row: 3, col: 3 },
  { id: "EE", name: "East of England", row: 3, col: 4 },
  { id: "SW", name: "South West", row: 4, col: 1 },
  { id: "LON", name: "London", row: 4, col: 3 },
  { id: "SE", name: "South East", row: 4, col: 4 },
];

export function sampleRegions(grid = UK_GRID, seed = 4): Region[] {
  let s = seed;
  return grid.map((g) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return { ...g, value: 20 + (s % 220) };
  });
}
