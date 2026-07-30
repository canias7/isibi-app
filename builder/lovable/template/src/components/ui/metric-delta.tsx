import { cn } from "@/lib/utils";
/**
 * How a number has moved.
 *
 * Direction is drawn with an arrow and stated in the label, never with colour
 * alone — and "up" is not assumed to be good, because for cancellations it is
 * not. The caller says.
 */
export function MetricDelta({ value, direction, good, className }: {
  value: string; direction: "up" | "down" | "flat"; good?: boolean; className?: string;
}) {
  const arrow = { up: "↑", down: "↓", flat: "→" }[direction];
  const isGood = good ?? direction === "up";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums",
      isGood ? "text-foreground" : "text-muted-foreground", className)}>
      <span aria-hidden="true">{arrow}</span>
      <span>{value}</span>
      <span className="sr-only">{direction === "flat" ? "no change" : direction}</span>
    </span>
  );
}
