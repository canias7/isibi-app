import { cn } from "@/lib/utils";
/**
 * How a number has moved.
 *
 * Colour says good or bad; the ARROW says the direction, and the direction is
 * also written into the accessibility tree. Up is not assumed to be good — for
 * cancellations or refunds it is not — so the caller decides, and the colour
 * follows that judgement rather than the arrow.
 */
export function MetricDelta({ value, direction, good, className }: {
  value: string; direction: "up" | "down" | "flat"; good?: boolean; className?: string;
}) {
  const arrow = { up: "↑", down: "↓", flat: "→" }[direction];
  const isGood = good ?? direction === "up";
  const tone = direction === "flat" ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive";
  return (
    <span data-slot="metric-delta" className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", tone, className)}>
      <span aria-hidden="true">{arrow}</span>
      <span>{value}</span>
      <span className="sr-only">{direction === "flat" ? "no change" : direction}</span>
    </span>
  );
}
