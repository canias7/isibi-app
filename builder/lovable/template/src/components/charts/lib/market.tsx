/** Market notations. Deterministic throughout. */

const TONE = "var(--foreground)";

export function seed(s0 = 1) {
  let s = s0;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 100000) / 100000; };
}
export function walk(n: number, start = 100, vol = 2, s0 = 7): number[] {
  const r = seed(s0);
  const out: number[] = [start];
  for (let i = 1; i < n; i++) out.push(Math.max(1, out[i - 1] + (r() - 0.48) * vol * 2));
  return out;
}

/* ------------------------------------------------------------------ renko */
/**
 * Bricks of a FIXED price size, drawn only when price moves that far.
 *
 * Time is dropped entirely — that is the whole notation. Two bricks side by
 * side may be an hour or a fortnight apart, which is what filters the noise a
 * candlestick shows.
 */
export function Renko({
  values, brick, height = 220, label,
}: {
  values: number[]; /** Price move per brick. */ brick?: number; height?: number; label?: string;
}) {
  if (values.length < 2) return null;
  const size = brick ?? ((Math.max(...values) - Math.min(...values)) / 18 || 1);
  const bricks: { from: number; to: number; up: boolean }[] = [];
  let base = values[0];
  for (const v of values) {
    while (v - base >= size) { bricks.push({ from: base, to: base + size, up: true }); base += size; }
    while (base - v >= size) { bricks.push({ from: base, to: base - size, up: false }); base -= size; }
  }
  if (!bricks.length) return null;
  const lo = Math.min(...bricks.map((b) => Math.min(b.from, b.to)));
  const hi = Math.max(...bricks.map((b) => Math.max(b.from, b.to)));
  const Y = (v: number) => ((hi - v) / (hi - lo || 1)) * 100;
  const w = 100 / bricks.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${bricks.length} bricks of ${size.toFixed(1)}`}>
      <div className="relative" style={{ height }}>
        {bricks.map((b, i) => (
          <div key={i} className="absolute border"
            style={{
              left: `${i * w}%`, width: `${w}%`,
              top: `${Math.min(Y(b.from), Y(b.to))}%`, height: `${Math.abs(Y(b.to) - Y(b.from))}%`,
              background: b.up ? "var(--background)" : TONE, borderColor: TONE,
            }} title={`${b.up ? "up" : "down"} ${b.from.toFixed(1)} → ${b.to.toFixed(1)}`} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Brick size {size.toFixed(1)} · hollow up, solid down · time is not on the axis
      </p>
    </div>
  );
}

/* -------------------------------------------------------- point and figure */
/** Columns of X (rising) and O (falling), with a reversal threshold. */
export function PointAndFigure({
  values, box, reversal = 3, cell = 13, label,
}: {
  values: number[]; box?: number; reversal?: number; cell?: number; label?: string;
}) {
  if (values.length < 2) return null;
  const size = box ?? ((Math.max(...values) - Math.min(...values)) / 20 || 1);
  const lvl = (v: number) => Math.floor(v / size);
  const cols: { up: boolean; from: number; to: number }[] = [];
  let dir: boolean | null = null;
  let cur = lvl(values[0]);
  for (const v of values) {
    const l = lvl(v);
    if (dir === null) { if (l !== cur) { dir = l > cur; cols.push({ up: dir, from: cur, to: l }); cur = l; } continue; }
    if (dir && l > cur) { cols[cols.length - 1].to = l; cur = l; }
    else if (!dir && l < cur) { cols[cols.length - 1].to = l; cur = l; }
    else if (Math.abs(l - cur) >= reversal) { dir = l > cur; cols.push({ up: dir, from: cur, to: l }); cur = l; }
  }
  if (!cols.length) return null;
  const lo = Math.min(...cols.flatMap((c) => [c.from, c.to]));
  const hi = Math.max(...cols.flatMap((c) => [c.from, c.to]));
  const rows = hi - lo + 1;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${cols.length} columns`}>
      <div className="relative" style={{ width: cols.length * cell, height: rows * cell }}>
        {cols.map((c, ci) =>
          Array.from({ length: Math.abs(c.to - c.from) + 1 }, (_, k) => {
            const l = c.up ? Math.min(c.from, c.to) + k : Math.max(c.from, c.to) - k;
            return (
              <span key={`${ci}-${k}`} className="absolute flex items-center justify-center text-[10px] leading-none"
                style={{ left: ci * cell, top: (hi - l) * cell, width: cell, height: cell, color: TONE }}>
                {c.up ? "×" : "○"}
              </span>
            );
          })
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Box {size.toFixed(1)} · {reversal}-box reversal · × rising, ○ falling
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ heikin-ashi */
/**
 * Candles built from averaged opens and closes, which smooths the series.
 *
 * Worth saying in the component: these are NOT real prices. The close is the
 * mean of the bar's own OHLC, so reading a level off it is wrong.
 */
export function HeikinAshi({
  bars, height = 220, format = (n: number) => n.toFixed(1), label,
}: {
  bars: { open: number; high: number; low: number; close: number }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!bars.length) return null;
  const ha: { o: number; h: number; l: number; c: number }[] = [];
  bars.forEach((b, i) => {
    const c = (b.open + b.high + b.low + b.close) / 4;
    const o = i === 0 ? (b.open + b.close) / 2 : (ha[i - 1].o + ha[i - 1].c) / 2;
    ha.push({ o, c, h: Math.max(b.high, o, c), l: Math.min(b.low, o, c) });
  });
  const lo = Math.min(...ha.map((b) => b.l)), hi = Math.max(...ha.map((b) => b.h));
  const Y = (v: number) => ((hi - v) / (hi - lo || 1)) * 100;
  const slot = 100 / ha.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${ha.length} smoothed candles`}>
      <div className="relative" style={{ height }}>
        {ha.map((b, i) => {
          const cx = i * slot + slot / 2;
          const up = b.c >= b.o;
          return (
            <div key={i}>
              <div className="absolute w-px -translate-x-1/2" style={{ left: `${cx}%`, top: `${Y(b.h)}%`, height: `${Y(b.l) - Y(b.h)}%`, background: TONE }} />
              <div className="absolute -translate-x-1/2 border"
                style={{
                  left: `${cx}%`, width: `${slot * 0.6}%`,
                  top: `${Math.min(Y(b.o), Y(b.c))}%`, height: `max(1px, ${Math.abs(Y(b.c) - Y(b.o))}%)`,
                  background: up ? "var(--background)" : TONE, borderColor: TONE,
                }} title={`O ${format(b.o)} H ${format(b.h)} L ${format(b.l)} C ${format(b.c)}`} />
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Averaged bars — smoother, but not real prices</p>
    </div>
  );
}

/* --------------------------------------------------------- volume profile */
/** How much traded at each price level, as a horizontal histogram. */
export function VolumeProfile({
  levels, height = 240, format = (n: number) => n.toFixed(0), label,
}: {
  levels: { price: number; volume: number }[]; height?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!levels.length) return null;
  const hi = Math.max(...levels.map((l) => l.volume)) || 1;
  const total = levels.reduce((s, l) => s + l.volume, 0);
  const poc = levels.reduce((a, b) => (a.volume >= b.volume ? a : b));
  const rowH = height / levels.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Volume across ${levels.length} price levels`}>
      <div className="relative" style={{ height }}>
        {[...levels].sort((a, b) => b.price - a.price).map((l, i) => (
          <div key={l.price}>
            <div className="absolute left-0 rounded-r-[2px]"
              style={{ top: i * rowH + 1, height: rowH - 2, width: `${(l.volume / hi) * 88}%`, background: TONE, opacity: l.price === poc.price ? 0.9 : 0.4 }}
              title={`${format(l.price)}: ${l.volume}`} />
            {l.price === poc.price ? (
              <span className="absolute text-[9px] text-muted-foreground" style={{ top: i * rowH, left: `${(l.volume / hi) * 88 + 2}%` }}>
                POC {format(l.price)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Point of control at {format(poc.price)} · {total.toLocaleString()} total
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- yield curve */
/** Rate against maturity, with an earlier curve for comparison. */
export function YieldCurve({
  curves, maturities, height = 220, format = (n: number) => n.toFixed(2) + "%", label,
}: {
  curves: { label: string; rates: number[] }[]; maturities: string[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!curves.length) return null;
  const all = curves.flatMap((c) => c.rates);
  const lo = Math.min(...all), hi = Math.max(...all);
  const X = (i: number) => (i / (maturities.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 92 - 4;
  const latest = curves[curves.length - 1].rates;
  const inverted = latest[0] > latest[latest.length - 1];

  return (
    <div className="w-full" role="img" aria-label={label ?? (inverted ? "Inverted curve" : "Upward sloping curve")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {curves.map((c, i) => (
            <polyline key={c.label} points={c.rates.map((v, k) => `${X(k)},${Y(v)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={i === curves.length - 1 ? 2.2 : 1.1}
              strokeOpacity={i === curves.length - 1 ? 1 : 0.4}
              strokeDasharray={i === curves.length - 1 ? undefined : "4 3"} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {maturities.map((m) => <span key={m}>{m}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {inverted ? "Inverted" : "Upward sloping"} · {format(latest[0])} to {format(latest[latest.length - 1])}
      </p>
    </div>
  );
}

/* ---------------------------------------------------- rolling correlation */
/**
 * Correlation over a moving window, about zero.
 *
 * Drawn diverging from zero rather than 0–1: correlation has a SIGN, and a
 * chart that hides which side of zero it sits on answers the wrong question.
 */
export function RollingCorrelation({
  a, b, window: win = 12, height = 210, label,
}: {
  a: number[]; b: number[]; window?: number; height?: number; label?: string;
}) {
  const n = Math.min(a.length, b.length);
  if (n < win) return null;
  const corr = (xs: number[], ys: number[]) => {
    const m = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / m, my = ys.reduce((s, v) => s + v, 0) / m;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < m; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    return num / (Math.sqrt(dx * dy) || 1);
  };
  const series = Array.from({ length: n - win + 1 }, (_, i) => corr(a.slice(i, i + win), b.slice(i, i + win)));
  const X = (i: number) => (i / (series.length - 1 || 1)) * 100;
  const Y = (v: number) => 50 - v * 46;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${win}-period rolling correlation`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,50 ${series.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} 100,50`} fill={TONE} fillOpacity={0.14} />
          <polyline points={series.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={50} y2={50} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {win}-period window · above the line is positive, below is negative
      </p>
    </div>
  );
}

/* ---------------------------------------------------- rolling volatility */
/** Standard deviation over a moving window. */
export function RollingVolatility({
  values, window: win = 12, height = 210, format = (n: number) => n.toFixed(1), label,
}: {
  values: number[]; window?: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (values.length < win) return null;
  const vol = Array.from({ length: values.length - win + 1 }, (_, i) => {
    const s = values.slice(i, i + win);
    const m = s.reduce((a, b) => a + b, 0) / win;
    return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / win);
  });
  const hi = Math.max(...vol) || 1;
  const mean = vol.reduce((s, v) => s + v, 0) / vol.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${win}-period volatility`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${vol.map((v, i) => `${(i / (vol.length - 1 || 1)) * 100},${100 - (v / hi) * 96}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.16} />
          <line x1={0} x2={100} y1={100 - (mean / hi) * 96} y2={100 - (mean / hi) * 96} stroke={TONE} strokeOpacity={0.45} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <polyline points={vol.map((v, i) => `${(i / (vol.length - 1 || 1)) * 100},${100 - (v / hi) * 96}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Average {format(mean)} · peak {format(hi)}</p>
    </div>
  );
}

/* ------------------------------------------------------ efficient frontier */
/** Risk against return, with the frontier drawn through the best of each. */
export function EfficientFrontier({
  assets, frontier, size = 270, label,
}: {
  assets: { label: string; risk: number; ret: number }[];
  frontier?: { risk: number; ret: number }[]; size?: number; label?: string;
}) {
  if (!assets.length) return null;
  const pts = [...assets, ...(frontier ?? [])];
  const rLo = Math.min(...pts.map((p) => p.risk)), rHi = Math.max(...pts.map((p) => p.risk));
  const yLo = Math.min(...pts.map((p) => p.ret)), yHi = Math.max(...pts.map((p) => p.ret));
  const X = (v: number) => ((v - rLo) / (rHi - rLo || 1)) * 88 + 6;
  const Y = (v: number) => 94 - ((v - yLo) / (yHi - yLo || 1)) * 88;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${assets.length} assets by risk and return`}>
        {frontier?.length ? (
          <polyline points={frontier.map((f) => `${X(f.risk)},${Y(f.ret)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} />
        ) : null}
        {assets.map((a) => (
          <g key={a.label}>
            <circle cx={X(a.risk)} cy={Y(a.ret)} r={2.6} fill={TONE} fillOpacity={0.8}><title>{a.label}</title></circle>
            <text x={X(a.risk)} y={Y(a.ret) - 5} textAnchor="middle" fontSize={7} className="fill-muted-foreground">{a.label}</text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Risk across, return up · the line is the frontier</p>
    </div>
  );
}

/* ------------------------------------------------------- risk-return grid */
/** Risk against return with quadrant guides at the medians. */
export function RiskReturnScatter({
  items, size = 270, label,
}: {
  items: { label: string; risk: number; ret: number; size?: number }[]; size?: number; label?: string;
}) {
  if (!items.length) return null;
  const rs = items.map((i) => i.risk).sort((a, b) => a - b);
  const ys = items.map((i) => i.ret).sort((a, b) => a - b);
  const medR = rs[Math.floor(rs.length / 2)], medY = ys[Math.floor(ys.length / 2)];
  const rLo = rs[0], rHi = rs[rs.length - 1], yLo = ys[0], yHi = ys[ys.length - 1];
  const X = (v: number) => ((v - rLo) / (rHi - rLo || 1)) * 84 + 8;
  const Y = (v: number) => 92 - ((v - yLo) / (yHi - yLo || 1)) * 84;
  const maxS = Math.max(1, ...items.map((i) => i.size ?? 1));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${items.length} items by risk and return`}>
        <line x1={X(medR)} y1={2} x2={X(medR)} y2={98} stroke="var(--border)" strokeDasharray="3 3" />
        <line x1={2} y1={Y(medY)} x2={98} y2={Y(medY)} stroke="var(--border)" strokeDasharray="3 3" />
        {items.map((it) => (
          <g key={it.label}>
            <circle cx={X(it.risk)} cy={Y(it.ret)} r={2 + Math.sqrt((it.size ?? 1) / maxS) * 4}
              fill={TONE} fillOpacity={0.25} stroke={TONE}><title>{it.label}</title></circle>
            <text x={X(it.risk)} y={Y(it.ret) - 6} textAnchor="middle" fontSize={7} className="fill-muted-foreground">{it.label}</text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Quadrants split at the medians · top left is best</p>
    </div>
  );
}

/* -------------------------------------------------------- equity drawdown */
/** The equity curve with its drawdown drawn underneath, on a shared x-axis. */
export function EquityDrawdown({
  values, height = 250, format = (n: number) => Math.round(n).toLocaleString(), label,
}: {
  values: number[]; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!values.length) return null;
  let peak = -Infinity;
  const dd = values.map((v) => { peak = Math.max(peak, v); return ((v - peak) / (peak || 1)) * 100; });
  const worst = Math.min(...dd) || -1;
  const lo = Math.min(...values), hi = Math.max(...values);
  const X = (i: number) => (i / (values.length - 1 || 1)) * 100;
  const topH = height * 0.62, botH = height * 0.34;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Equity with a worst drawdown of ${worst.toFixed(0)}%`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height: topH }}>
        <polyline points={values.map((v, i) => `${X(i)},${100 - ((v - lo) / (hi - lo || 1)) * 96 - 2}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-1 w-full" style={{ height: botH }}>
        <polygon points={`0,0 ${dd.map((v, i) => `${X(i)},${(v / worst) * 96}`).join(" ")} 100,0`} fill={TONE} fillOpacity={0.2} />
        <polyline points={dd.map((v, i) => `${X(i)},${(v / worst) * 96}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {format(values[0])} → {format(values[values.length - 1])} · worst drawdown {worst.toFixed(0)}%
      </p>
    </div>
  );
}
