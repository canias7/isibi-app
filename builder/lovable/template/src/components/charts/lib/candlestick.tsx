/**
 * Open-high-low-close bars.
 *
 * Up and down are told apart by FILL (hollow versus solid), not by colour —
 * the red/green convention is the single most common chart that fails for the
 * ~8% of men with red-green colour blindness, and it fails silently.
 */
export type Candle = { label: string; open: number; high: number; low: number; close: number };

export function Candlestick({
  candles,
  height = 220,
  min,
  max,
  format = (n: number) => n.toFixed(2),
  showAxis = true,
  showLabels = false,
  bodyWidth = 0.6,
  label,
}: {
  candles: Candle[];
  height?: number;
  min?: number;
  max?: number;
  format?: (n: number) => string;
  showAxis?: boolean;
  showLabels?: boolean;
  /** Body width as a fraction of the column. */
  bodyWidth?: number;
  label?: string;
}) {
  if (!candles.length) return null;

  const lo = min ?? Math.min(...candles.map((c) => c.low));
  const hi = max ?? Math.max(...candles.map((c) => c.high));
  const span = hi - lo || 1;
  const y = (v: number) => ((hi - v) / span) * 100;

  const slot = 100 / candles.length;
  const bw = slot * bodyWidth;

  return (
    <div className="w-full" role="img"
      aria-label={label ?? `${candles.length} periods, ${format(lo)} to ${format(hi)}`}>
      <div className="flex">
        <div className="relative flex-1" style={{ height }}>
          {candles.map((c, i) => {
            const centre = i * slot + slot / 2;
            const up = c.close >= c.open;
            const top = Math.min(y(c.open), y(c.close));
            const h = Math.abs(y(c.close) - y(c.open));
            return (
              <div key={`${c.label}-${i}`} title={`${c.label}  O ${format(c.open)}  H ${format(c.high)}  L ${format(c.low)}  C ${format(c.close)}`}>
                {/* wick */}
                <div className="absolute bg-foreground"
                  style={{ left: `${centre}%`, width: 1, top: `${y(c.high)}%`, height: `${y(c.low) - y(c.high)}%` }} />
                {/* body — a doji has no height, so it keeps a 1px floor or it vanishes */}
                <div className="absolute border border-foreground"
                  style={{
                    left: `${centre - bw / 2}%`,
                    width: `${bw}%`,
                    top: `${top}%`,
                    height: `max(1px, ${h}%)`,
                    background: up ? "var(--background)" : "var(--foreground)",
                  }} />
              </div>
            );
          })}
        </div>
        {showAxis ? (
          <div className="relative ml-2 w-10 shrink-0 text-[10px] tabular-nums text-muted-foreground" style={{ height }}>
            <span className="absolute top-0 right-0">{format(hi)}</span>
            <span className="absolute right-0 bottom-0">{format(lo)}</span>
          </div>
        ) : null}
      </div>
      {showLabels ? (
        <div className="flex">
          {candles.map((c, i) => (
            <div key={`${c.label}-lab-${i}`} className="truncate text-center text-[9px] text-muted-foreground"
              style={{ width: `${slot}%` }}>
              {c.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function sampleCandles(n: number, start = 42, seed = 11): Candle[] {
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 1000) / 1000; };
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const open = price;
    const drift = (next() - 0.45) * 4;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + next() * 1.6;
    const low = Math.max(0.5, Math.min(open, close) - next() * 1.6);
    out.push({ label: `D${i + 1}`, open, high, low, close });
    price = close;
  }
  return out;
}
