import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "8 of 10 seats used."
 *
 * The bar is capped at 100% while the number is not: being over the limit is
 * a real state (somebody downgraded), and a bar that renders 140% wide breaks
 * out of its own container.
 */
export function SeatUsage({ used, total, onAdd, className }: {
  used: number; total: number; onAdd?: () => void; className?: string;
}) {
  const pct = total ? (used / total) * 100 : 0;
  const over = used > total;
  return (
    <div data-slot="seat-usage" className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm">
          <strong className="tabular-nums">{used.toLocaleString()}</strong>
          <span className="text-muted-foreground"> of {total.toLocaleString()} seats used</span>
        </p>
        {onAdd && <Button size="sm" variant="outline" onClick={onAdd}>Add seats</Button>}
      </div>
      <Progress value={Math.min(100, pct)} className="h-1.5"
        aria-label={`Seats: ${used.toLocaleString()} of ${total.toLocaleString()} used`} />
      {over && <p className="text-xs text-destructive">Over the limit — {(used - total).toLocaleString()} more than this plan allows.</p>}
    </div>
  );
}
