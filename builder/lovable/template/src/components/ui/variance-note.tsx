import { cn } from "@/lib/utils";
/**
 * How far off plan, in both the absolute and the relative.
 *
 * BOTH NUMBERS, ALWAYS. "£4,000 over" on a £2m budget is noise; "£4,000 over" on
 * a £10,000 budget is a crisis. Either figure alone can mislead badly, and
 * showing both takes one extra clause.
 *
 * THE DIRECTION IS A WORD, and `goodDirection` decides whether it reads as good
 * news. Under budget is good, under revenue is not, and a component that assumes
 * congratulates people on missing targets.
 *
 * `withinTolerance` renders "on plan" rather than a tiny variance, because
 * reporting 0.4% over as a deviation trains readers to ignore the line entirely.
 */
export function VarianceNote({ actual, planned, unit = "", goodDirection = "down", tolerancePct = 0, className }: {
  actual: number; planned: number; unit?: string;
  /** Which way is good — "down" for cost, "up" for revenue. */
  goodDirection?: "up" | "down";
  /** Within this percentage counts as on plan. */
  tolerancePct?: number;
  className?: string;
}) {
  if (planned === 0) return null;
  const diff = actual - planned;
  const pct = (diff / Math.abs(planned)) * 100;
  if (Math.abs(pct) <= tolerancePct) {
    return <p className={cn("text-sm text-muted-foreground", className)}>On plan</p>;
  }
  const over = diff > 0;
  const good = goodDirection === "up" ? over : !over;
  const fmt = (n: number) => `${unit}${Math.abs(n).toLocaleString()}`;
  return (
    <p className={cn("text-sm tabular-nums", className)}>
      <span className={cn(good ? "text-muted-foreground" : "font-medium")}>
        {fmt(diff)} {over ? "over" : "under"}
      </span>
      <span className="text-muted-foreground"> · {Math.abs(Math.round(pct * 10) / 10)}% of plan</span>
    </p>
  );
}
