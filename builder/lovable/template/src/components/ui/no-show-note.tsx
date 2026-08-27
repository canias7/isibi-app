import { cn } from "@/lib/utils";
/**
 * A customer's history of not turning up, stated without accusation.
 *
 * IT SHOWS THE DENOMINATOR, ALWAYS. "2 no-shows" against 3 bookings and against
 * 60 are opposite facts, and the bare count is the version that gets somebody
 * refused unfairly. A rate needs both numbers or it is not a rate.
 *
 * IT GOES QUIET BELOW A THRESHOLD. Everybody misses one eventually, and a
 * permanent mark for a single missed appointment two years ago is a punishment
 * the business did not intend to apply.
 *
 * NO SCORE, NO BADGE, NO COLOUR. This appears next to a real person's name on
 * an owner's screen, and turning it into a red flag makes the decision for them
 * — which is exactly what a component should not do with a fact this
 * consequential. Plain sentence, plain weight.
 *
 * THE MOST RECENT ONE IS DATED, because "two, both last winter" and "two, both
 * last month" mean different things and the count cannot say which.
 */
export function NoShowNote({ missed, total, lastMissed, showFrom = 2, className }: {
  missed: number;
  /** Bookings in the same period. */
  total: number;
  /** Free text — "last month", "in January". */
  lastMissed?: string;
  /** Below this many, nothing is shown. */
  showFrom?: number;
  className?: string;
}) {
  if (missed < showFrom || total <= 0) return null;
  const pct = Math.round((missed / total) * 100);
  return (
    <p data-slot="no-show-note" className={cn("text-sm", className)}>
      <span className="tabular-nums">{missed}</span>
      <span className="text-muted-foreground"> of </span>
      <span className="tabular-nums">{total}</span>
      <span className="text-muted-foreground"> bookings missed · {pct}%</span>
      {lastMissed && <span className="block text-xs text-muted-foreground">Most recently {lastMissed}.</span>}
    </p>
  );
}
