import { cn } from "@/lib/utils";
/**
 * Labelled horizontal bars — top pages, top sources, best sellers.
 *
 * The label sits INSIDE the bar rather than in a column beside it, so long
 * names do not squeeze every bar into a stub. Bars are scaled to the largest
 * value, not to the total: this answers "which is biggest", and a share-of-total
 * question wants `RatioBar`.
 */
export function BarList({ items, valueLabel, className }: {
  items: { label: string; value: number; href?: string }[];
  valueLabel?: (n: number) => string; className?: string;
}) {
  if (!items.length) return null;
  const hi = Math.max(...items.map((i) => i.value)) || 1;
  const fmt = valueLabel ?? ((n: number) => n.toLocaleString());
  return (
    <div className={cn("space-y-1.5", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted">
            <div className="absolute inset-y-0 left-0 bg-foreground/10"
              style={{ width: `${Math.max(2, (it.value / hi) * 100)}%` }} />
            <span className="relative flex h-full items-center truncate px-2 text-sm">
              {it.href ? <a href={it.href} className="truncate hover:underline">{it.label}</a> : it.label}
            </span>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{fmt(it.value)}</span>
        </div>
      ))}
    </div>
  );
}
