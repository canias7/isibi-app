/**
 * Actual against target, with qualitative bands behind it.
 *
 * Denser than a gauge and stackable, which is the point: a KPI list wants six
 * of these in the space one dial would take. The target is a perpendicular
 * TICK, never a second bar — a bar-versus-bar reads as two measurements when
 * one of them is a threshold.
 */
export function Bullet({
  value,
  target,
  max,
  bands,
  label,
  sub,
  format = (n: number) => n.toLocaleString(),
  height = 14,
  showScale = false,
}: {
  value: number;
  target?: number;
  max?: number;
  /** Band edges, ascending, as fractions of max. Drawn lightest-to-darkest. */
  bands?: number[];
  label?: string;
  sub?: string;
  format?: (n: number) => string;
  height?: number;
  showScale?: boolean;
}) {
  const hi = max ?? (Math.max(value, target ?? 0) * 1.25 || 1);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / hi) * 100));
  const edges = bands ?? [0.5, 0.75, 1];

  return (
    <div className="w-full">
      {(label || sub) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label ? <span className="truncate text-xs font-medium">{label}</span> : <span />}
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {format(value)}
            {target !== undefined ? <span className="text-muted-foreground"> / {format(target)}</span> : null}
          </span>
        </div>
      )}
      <div
        className="relative w-full overflow-hidden rounded-[2px]"
        style={{ height }}
        role="img"
        aria-label={`${label ?? "Value"} ${format(value)}${target !== undefined ? ` against a target of ${format(target)}` : ""}`}
      >
        {edges.map((e, i) => (
          <div key={e} className="absolute top-0 bottom-0 left-0 bg-foreground"
            style={{ width: `${e * 100}%`, opacity: 0.06 + i * 0.05 }} />
        ))}
        <div className="absolute top-1/2 left-0 h-1/2 -translate-y-1/2 rounded-[2px] bg-foreground"
          style={{ width: `${pct(value)}%` }} />
        {target !== undefined ? (
          <div className="absolute top-0 bottom-0 w-[2px] bg-foreground"
            style={{ left: `calc(${pct(target)}% - 1px)` }} />
        ) : null}
      </div>
      {showScale ? (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>0</span>
          <span>{format(hi)}</span>
        </div>
      ) : null}
      {sub ? <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function BulletList({ items, ...rest }: { items: Parameters<typeof Bullet>[0][] } & { className?: string }) {
  void rest;
  return (
    <div className="space-y-4">
      {items.map((it, i) => <Bullet key={`${it.label ?? i}`} {...it} />)}
    </div>
  );
}
