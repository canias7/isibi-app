/**
 * One vertical axis per dimension, one polyline per record.
 *
 * Each axis is scaled to its OWN min and max — the dimensions are different
 * units (£, minutes, a 1–5 rating) and a shared scale would flatten every one
 * of them against the largest. That is the whole reason this chart exists, and
 * the mistake that makes it useless.
 */
export type Axis = { key: string; label?: string; min?: number; max?: number; invert?: boolean };

export function ParallelCoordinates({
  axes,
  rows,
  height = 240,
  highlight,
  format = (n: number) => String(Math.round(n)),
  showTicks = true,
  label,
}: {
  axes: Axis[];
  rows: Record<string, number | string>[];
  height?: number;
  /** Index of the row to draw heavier. */
  highlight?: number;
  format?: (n: number) => string;
  showTicks?: boolean;
  label?: string;
}) {
  if (!axes.length || !rows.length) return null;

  const scales = axes.map((a) => {
    const vals = rows.map((r) => Number(r[a.key])).filter((v) => Number.isFinite(v));
    const lo = a.min ?? Math.min(...vals);
    const hi = a.max ?? Math.max(...vals);
    return { ...a, lo, hi, span: hi - lo || 1 };
  });

  const x = (i: number) => (i / (axes.length - 1 || 1)) * 100;
  const y = (v: number, i: number) => {
    const s = scales[i];
    const t = (v - s.lo) / s.span;
    return (s.invert ? t : 1 - t) * 100;
  };

  return (
    <div className="w-full" role="img"
      aria-label={label ?? `${rows.length} records across ${axes.length} measures`}>
      <div className="relative w-full" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {scales.map((_, i) => (
            <line key={i} x1={x(i)} x2={x(i)} y1={0} y2={100}
              stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {rows.map((r, ri) => {
            const pts = scales.map((s, i) => `${x(i)},${y(Number(r[s.key]), i)}`).join(" ");
            const on = highlight === ri;
            return (
              <polyline key={ri} points={pts} fill="none" stroke="var(--foreground)"
                strokeWidth={on ? 2.2 : 1} strokeOpacity={on ? 1 : 0.28}
                vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
        {showTicks
          ? scales.map((s, i) => (
              <div key={`${s.key}-ticks`} className="pointer-events-none absolute top-0 bottom-0"
                style={{ left: `${x(i)}%` }}>
                <span className="absolute top-0 -translate-x-1/2 -translate-y-full text-[9px] tabular-nums text-muted-foreground">
                  {format(s.invert ? s.lo : s.hi)}
                </span>
                <span className="absolute bottom-0 -translate-x-1/2 translate-y-full text-[9px] tabular-nums text-muted-foreground">
                  {format(s.invert ? s.hi : s.lo)}
                </span>
              </div>
            ))
          : null}
      </div>
      <div className="mt-4 flex">
        {scales.map((s, i) => (
          <div key={s.key}
            className="truncate text-[10px] text-muted-foreground"
            style={{
              width: `${100 / scales.length}%`,
              textAlign: i === 0 ? "left" : i === scales.length - 1 ? "right" : "center",
            }}>
            {s.label ?? s.key}
          </div>
        ))}
      </div>
    </div>
  );
}

export const SERVICE_AXES: Axis[] = [
  { key: "price", label: "Price" },
  { key: "minutes", label: "Minutes" },
  { key: "rating", label: "Rating" },
  { key: "repeat", label: "Repeat %" },
];
export const SERVICE_ROWS = [
  { name: "Cut", price: 24, minutes: 35, rating: 4.6, repeat: 68 },
  { name: "Beard", price: 14, minutes: 20, rating: 4.4, repeat: 54 },
  { name: "Colour", price: 62, minutes: 95, rating: 4.8, repeat: 41 },
  { name: "Towel", price: 18, minutes: 25, rating: 4.2, repeat: 33 },
  { name: "Kids", price: 16, minutes: 25, rating: 4.5, repeat: 72 },
  { name: "Wash", price: 9, minutes: 15, rating: 4.1, repeat: 60 },
];
