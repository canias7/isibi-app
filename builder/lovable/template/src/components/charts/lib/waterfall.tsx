/**
 * How a total got from opening to closing — floating bars, each starting where
 * the last one finished.
 *
 * Recharts can fake this with a stacked bar and a transparent base segment, and
 * that fake is why it is worth writing properly: the transparent segment still
 * appears in the tooltip and the legend as a real series, so a visitor hovers a
 * profit bar and is told about a value nobody chose to publish.
 *
 * Rises and falls are told apart by FILL and by an arrow in the label, never by
 * colour alone.
 */
export type Step = {
  label: string;
  /** Signed delta. Ignored when `total` is true. */
  value: number;
  /** Draws a full-height bar from zero — an opening or closing balance. */
  total?: boolean;
};

export function Waterfall({
  steps,
  height = 220,
  format = (n: number) => n.toLocaleString(),
  showConnectors = true,
  showValues = true,
  label,
}: {
  steps: Step[];
  height?: number;
  format?: (n: number) => string;
  showConnectors?: boolean;
  showValues?: boolean;
  label?: string;
}) {
  if (!steps.length) return null;

  // Running balance: a `total` step is an absolute position, everything else is
  // a delta applied to whatever came before it.
  let run = 0;
  const bars = steps.map((s) => {
    const from = s.total ? 0 : run;
    const to = s.total ? s.value : run + s.value;
    run = to;
    return { ...s, from, to, rise: to >= from };
  });

  const lo = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
  const hi = Math.max(...bars.map((b) => Math.max(b.from, b.to))) || 1;
  const span = hi - lo || 1;
  const y = (v: number) => ((hi - v) / span) * 100;

  const colW = 100 / bars.length;
  const barW = colW * 0.62;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Waterfall, ${bars.length} steps, closing at ${format(run)}`}>
      <div className="relative w-full" style={{ height }}>
        {y(0) >= 0 && y(0) <= 100 ? (
          <div className="absolute right-0 left-0 border-t border-border" style={{ top: `${y(0)}%` }} />
        ) : null}
        {bars.map((b, i) => {
          const top = Math.min(y(b.from), y(b.to));
          const h = Math.abs(y(b.to) - y(b.from));
          const left = i * colW + (colW - barW) / 2;
          return (
            <div key={`${b.label}-${i}`}>
              {showConnectors && i < bars.length - 1 && !bars[i + 1].total ? (
                <div className="absolute border-t border-dashed border-border"
                  style={{ top: `${y(b.to)}%`, left: `${left + barW}%`, width: `${colW - barW}%` }} />
              ) : null}
              <div
                className="absolute rounded-[2px]"
                style={{
                  top: `${top}%`,
                  height: `max(2px, ${h}%)`,
                  left: `${left}%`,
                  width: `${barW}%`,
                  background: b.total
                    ? "var(--foreground)"
                    : b.rise
                      ? "color-mix(in oklch, var(--foreground) 62%, transparent)"
                      : "color-mix(in oklch, var(--foreground) 22%, transparent)",
                  border: b.total || b.rise ? undefined : "1px solid color-mix(in oklch, var(--foreground) 55%, transparent)",
                }}
                title={`${b.label}: ${format(b.total ? b.to : b.value)}`}
              />
              {showValues ? (
                <div className="absolute text-center text-[10px] tabular-nums text-muted-foreground"
                  style={{ top: `calc(${top}% - 14px)`, left: `${i * colW}%`, width: `${colW}%` }}>
                  {b.total ? format(b.to) : `${b.rise ? "↑" : "↓"}${format(Math.abs(b.value))}`}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex">
        {bars.map((b, i) => (
          <div key={`${b.label}-lab-${i}`} className="truncate px-1 text-center text-[10px] text-muted-foreground"
            style={{ width: `${colW}%` }}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
