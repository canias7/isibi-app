/** Ranking and comparison charts recharts has no primitive for. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------------- tornado */
/**
 * Sensitivity: how far each input swings the outcome, widest bar at the top.
 *
 * Both directions share ONE scale centred on the base case, so a bar that is
 * twice as long really is twice the swing — scaling each side to its own
 * maximum is the mistake that makes this chart lie.
 */
export function Tornado({
  items, base, height = 240, format = (n: number) => String(n), label,
}: {
  items: { label: string; low: number; high: number }[];
  base: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!items.length) return null;
  const rows = [...items].sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  const reach = Math.max(...rows.map((r) => Math.max(Math.abs(r.high - base), Math.abs(r.low - base)))) || 1;
  const rowH = height / rows.length;
  const pct = (v: number) => 50 + ((v - base) / reach) * 48;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Sensitivity of ${rows.length} inputs around ${format(base)}`}>
      <div className="relative" style={{ height }}>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        {rows.map((r, i) => {
          const a = Math.min(pct(r.low), pct(r.high));
          const b = Math.max(pct(r.low), pct(r.high));
          return (
            <div key={r.label}>
              <div className="absolute rounded-[2px]"
                style={{ top: i * rowH + rowH * 0.22, height: rowH * 0.56, left: `${a}%`, width: `${b - a}%`, background: TONE, opacity: 0.75 }}
                title={`${r.label}: ${format(r.low)} to ${format(r.high)}`} />
              <span className="absolute text-[10px] text-muted-foreground"
                style={{ top: i * rowH + rowH * 0.28, left: 0 }}>{r.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{format(base - reach)}</span><span>{format(base)}</span><span>{format(base + reach)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- range bar */
/** A min–max span per category — opening hours, price ranges, forecast bands. */
export function RangeBar({
  items, height = 220, min, max, format = (n: number) => String(n), showPoint = true, label,
}: {
  items: { label: string; low: number; high: number; point?: number }[];
  height?: number; min?: number; max?: number;
  format?: (n: number) => string; showPoint?: boolean; label?: string;
}) {
  if (!items.length) return null;
  const lo = min ?? Math.min(...items.map((i) => i.low));
  const hi = max ?? Math.max(...items.map((i) => i.high));
  const span = hi - lo || 1;
  const rowH = height / items.length;
  const pct = (v: number) => ((v - lo) / span) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${items.length} ranges from ${format(lo)} to ${format(hi)}`}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2" style={{ height: rowH }}>
          <span className="w-16 shrink-0 truncate text-right text-[10px] text-muted-foreground">{it.label}</span>
          <div className="relative h-full flex-1">
            <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
              style={{ left: `${pct(it.low)}%`, width: `${pct(it.high) - pct(it.low)}%`, background: TONE, opacity: 0.28 }} />
            {showPoint && it.point !== undefined ? (
              <div className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pct(it.point)}%`, background: TONE }} title={format(it.point)} />
            ) : null}
          </div>
          <span className="w-20 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {format(it.low)}–{format(it.high)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ bump chart */
/**
 * Rank across many periods. `slope` handles two; this is the version for a
 * season. Position is RANK, not value — the whole point is who overtook whom.
 */
export function BumpChart({
  series, periods, height = 240, highlight, label,
}: {
  series: { label: string; ranks: number[] }[];
  periods: string[]; height?: number; highlight?: string; label?: string;
}) {
  if (!series.length) return null;
  const n = Math.max(...series.flatMap((s) => s.ranks));
  const x = (i: number) => (i / (periods.length - 1 || 1)) * 100;
  const y = (r: number) => ((r - 1) / (n - 1 || 1)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Rank of ${series.length} series across ${periods.length} periods`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {series.map((s) => {
            const on = highlight === s.label;
            return (
              <polyline key={s.label} points={s.ranks.map((r, i) => `${x(i)},${y(r)}`).join(" ")}
                fill="none" stroke={TONE} strokeWidth={on ? 2.4 : 1} strokeOpacity={on ? 1 : 0.3}
                strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
        {series.map((s) => (
          <div key={`${s.label}-dots`}>
            {s.ranks.map((r, i) => (
              <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${x(i)}%`, top: `${y(r)}%`, background: TONE, opacity: highlight === s.label ? 1 : 0.45 }} />
            ))}
            <span className="absolute -translate-y-1/2 pl-1 text-[10px] whitespace-nowrap"
              style={{ left: "100%", top: `${y(s.ranks[s.ranks.length - 1])}%` }}>
              <span className={highlight === s.label ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between pr-12 text-[10px] text-muted-foreground">
        {periods.map((p) => <span key={p}>{p}</span>)}
      </div>
    </div>
  );
}
