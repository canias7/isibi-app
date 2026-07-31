/**
 * Map-shaped charts on the same tile grid `choropleth` and `flow-map` use.
 *
 * Real geography needs boundary polygons: a mapping dependency, or 100 KB+ of
 * GeoJSON in every generated site's bundle. The grid keeps the comparison,
 * which is what these are read for, and costs nothing.
 */

const TONE = "var(--foreground)";

export type Tile = { id: string; row: number; col: number; value: number };

/** UK nations and English regions, laid out roughly geographically. */
export const UK_TILES: Omit<Tile, "value">[] = [
  { id: "SCO", row: 0, col: 2 }, { id: "NI", row: 1, col: 0 }, { id: "NE", row: 1, col: 3 },
  { id: "NW", row: 2, col: 2 }, { id: "YH", row: 2, col: 3 }, { id: "WAL", row: 3, col: 1 },
  { id: "WM", row: 3, col: 2 }, { id: "EM", row: 3, col: 3 }, { id: "EE", row: 3, col: 4 },
  { id: "SW", row: 4, col: 1 }, { id: "LON", row: 4, col: 3 }, { id: "SE", row: 4, col: 4 },
];

const layout = (tiles: { row: number; col: number }[], cell: number, gap: number) => {
  const step = cell + gap;
  return {
    step,
    w: (Math.max(...tiles.map((t) => t.col)) + 1) * step,
    h: (Math.max(...tiles.map((t) => t.row)) + 1) * step,
  };
};

/* -------------------------------------------------------- dot density map */
/**
 * One dot per N units, scattered inside each tile.
 *
 * Density rather than shade — the eye counts clusters better than it ranks
 * greys, and unlike a choropleth the total is preserved: twice the dots really
 * is twice the number.
 */
export function DotDensityMap({
  tiles, per = 10, cell = 52, gap = 5, dot = 2.4, label,
}: {
  tiles: Tile[]; /** Units each dot stands for. */ per?: number;
  cell?: number; gap?: number; dot?: number; label?: string;
}) {
  if (!tiles.length) return null;
  const { step, w, h } = layout(tiles, cell, gap);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}
        role="img" aria-label={label ?? `${tiles.length} areas, one dot per ${per}`}>
        {tiles.map((t) => {
          const n = Math.round(t.value / per);
          // Deterministic scatter: a per-tile seed derived from its position,
          // so the same data always draws the same dots.
          let s = (t.row + 1) * 73 + (t.col + 1) * 31;
          const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 1000) / 1000; };
          return (
            <g key={t.id}>
              <rect x={t.col * step} y={t.row * step} width={cell} height={cell} rx={4}
                fill="var(--muted)" stroke="var(--border)" />
              {Array.from({ length: n }, (_, i) => (
                <circle key={i}
                  cx={t.col * step + 4 + next() * (cell - 8)}
                  cy={t.row * step + 4 + next() * (cell - 8)}
                  r={dot} fill={TONE} fillOpacity={0.75} />
              ))}
              <text x={t.col * step + cell / 2} y={t.row * step + cell - 4} textAnchor="middle"
                fontSize={8} className="fill-muted-foreground">{t.id}</text>
              <title>{`${t.id}: ${t.value}`}</title>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[10px] text-muted-foreground">One dot = {per}</p>
    </div>
  );
}

/* ------------------------------------------------- proportional symbol map */
/** A circle per area, AREA proportional to value. */
export function ProportionalSymbolMap({
  tiles, cell = 52, gap = 5, format = (n: number) => String(n), label,
}: {
  tiles: Tile[]; cell?: number; gap?: number; format?: (n: number) => string; label?: string;
}) {
  if (!tiles.length) return null;
  const { step, w, h } = layout(tiles, cell, gap);
  const hi = Math.max(...tiles.map((t) => t.value)) || 1;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}
        role="img" aria-label={label ?? `${tiles.length} areas by size`}>
        {tiles.map((t) => {
          // sqrt, so AREA tracks the value. Scaling the radius directly would
          // square every difference — the single most common map error.
          const r = Math.sqrt(t.value / hi) * (cell / 2 - 3);
          return (
            <g key={t.id}>
              <rect x={t.col * step} y={t.row * step} width={cell} height={cell} rx={4} fill="none" stroke="var(--border)" />
              <circle cx={t.col * step + cell / 2} cy={t.row * step + cell / 2} r={r}
                fill={TONE} fillOpacity={0.28} stroke={TONE} strokeWidth={1}>
                <title>{`${t.id}: ${format(t.value)}`}</title>
              </circle>
              <text x={t.col * step + cell / 2} y={t.row * step + cell / 2} textAnchor="middle"
                dominantBaseline="middle" fontSize={8} className="fill-foreground">{t.id}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------- spider map */
/** Straight lines from one hub to everywhere it reaches. */
export function SpiderMap({
  hub, spokes, cell = 52, gap = 5, label,
}: {
  hub: { id: string; row: number; col: number };
  spokes: Tile[]; cell?: number; gap?: number; label?: string;
}) {
  if (!spokes.length) return null;
  const all = [hub, ...spokes];
  const { step, w, h } = layout(all, cell, gap);
  const hi = Math.max(...spokes.map((s) => s.value)) || 1;
  const c = (t: { row: number; col: number }) => ({ x: t.col * step + cell / 2, y: t.row * step + cell / 2 });
  const hc = c(hub);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}
      role="img" aria-label={label ?? `${spokes.length} routes into ${hub.id}`}>
      {spokes.map((s) => {
        const p = c(s);
        return (
          <line key={s.id} x1={hc.x} y1={hc.y} x2={p.x} y2={p.y}
            stroke={TONE} strokeOpacity={0.3} strokeWidth={0.8 + (s.value / hi) * 4} strokeLinecap="round">
            <title>{`${s.id} → ${hub.id}: ${s.value}`}</title>
          </line>
        );
      })}
      {spokes.map((s) => {
        const p = c(s);
        return (
          <g key={`n-${s.id}`}>
            <circle cx={p.x} cy={p.y} r={9} fill="var(--muted)" stroke="var(--border)" />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={7} className="fill-foreground">{s.id}</text>
          </g>
        );
      })}
      <circle cx={hc.x} cy={hc.y} r={13} fill={TONE} />
      <text x={hc.x} y={hc.y} textAnchor="middle" dominantBaseline="middle" fontSize={8} className="fill-background">{hub.id}</text>
    </svg>
  );
}

/* ------------------------------------------------------------- isotype map */
/** Repeated glyphs per area — countable, unlike a shade. */
export function IsotypeMap({
  tiles, per = 20, glyph = "▮", cell = 62, gap = 5, label,
}: {
  tiles: Tile[]; per?: number; glyph?: string; cell?: number; gap?: number; label?: string;
}) {
  if (!tiles.length) return null;
  const step = cell + gap;
  const cols = Math.max(...tiles.map((t) => t.col)) + 1;
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;

  return (
    <div className="w-full">
      <div className="relative" style={{ width: cols * step, height: rows * step }}
        role="img" aria-label={label ?? `${tiles.length} areas, one mark per ${per}`}>
        {tiles.map((t) => (
          <div key={t.id}
            className="absolute flex flex-col items-center justify-center rounded-[4px] border border-border bg-muted p-1"
            style={{ left: t.col * step, top: t.row * step, width: cell, height: cell }}
            title={`${t.id}: ${t.value}`}>
            <span className="text-[6px] leading-[1.1] break-all" style={{ color: TONE }}>
              {glyph.repeat(Math.max(0, Math.round(t.value / per)))}
            </span>
            <span className="mt-0.5 text-[8px] text-muted-foreground">{t.id}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">One {glyph} = {per}</p>
    </div>
  );
}

/** Deterministic sample values for the tile grid. */
export function sampleTiles(base = UK_TILES, seed = 4): Tile[] {
  let s = seed;
  return base.map((t) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return { ...t, value: 20 + (s % 200) };
  });
}
