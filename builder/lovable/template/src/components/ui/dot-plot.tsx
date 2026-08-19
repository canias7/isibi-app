import { cn } from "@/lib/utils";
/**
 * Where each row sits on a shared scale — price against the range, score
 * against the class.
 *
 * One scale for every row, computed once here. Per-row scaling would put every
 * dot in the middle and say nothing, which is the usual way this chart is got
 * wrong.
 */
export function DotPlot({ items, min, max, format, className }: {
  items: { label: string; value: number }[];
  min?: number; max?: number; format?: (n: number) => string; className?: string;
}) {
  if (!items.length) return null;
  const lo = min ?? Math.min(...items.map((i) => i.value));
  const hi = max ?? Math.max(...items.map((i) => i.value));
  const span = hi - lo || 1;
  const fmt = format ?? ((n: number) => n.toLocaleString());
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-muted-foreground">{it.label}</span>
          <span className="relative h-4 min-w-0 flex-1">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${((it.value - lo) / span) * 100}%` }} />
          </span>
          <span className="w-16 shrink-0 text-end tabular-nums">{fmt(it.value)}</span>
        </div>
      ))}
      {/* The axis labels sit in the same three-column row as the data, not in a
          justified row of their own — otherwise the right-hand one lines up
          with the value column instead of the end of the scale it describes. */}
      <div className="flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
        <span className="w-24 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 justify-between"><span>{fmt(lo)}</span><span>{fmt(hi)}</span></span>
        <span className="w-16 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}
