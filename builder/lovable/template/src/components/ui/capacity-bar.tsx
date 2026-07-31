import { cn } from "@/lib/utils";
/**
 * How full somebody's day or a room already is.
 *
 * OVER capacity is a real state and is drawn as such — the bar caps at 100%
 * while the numbers do not, and the overflow gets its own marked segment. A
 * bar that silently clamps makes 110% and 100% look identical, which is
 * exactly the row a manager is scanning for.
 */
export function CapacityBar({ used, capacity, unit = "hrs", label, className }: {
  used: number; capacity: number; unit?: string; label?: string; className?: string;
}) {
  const pct = capacity > 0 ? (used / capacity) * 100 : 0;
  const over = used > capacity;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        {label && <span className="truncate">{label}</span>}
        <span className={cn("tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
          {used}/{capacity} {unit}{over && ` · ${(used - capacity).toFixed(used % 1 ? 1 : 0)} over`}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <span className="bg-foreground" style={{ width: `${Math.min(100, pct)}%` }} />
        {over && <span className="bg-destructive"
          style={{ width: `${Math.min(20, pct - 100)}%` }} />}
      </div>
    </div>
  );
}
