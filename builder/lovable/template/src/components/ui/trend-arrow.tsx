import { cn } from "@/lib/utils";
/**
 * The direction on its own, for a table cell where `MetricDelta` (number and
 * arrow together) would not fit.
 *
 * `good` is separate from `direction` deliberately: down is the good direction
 * for refunds, cancellations and response time, and a component that assumes
 * up-is-good colours half a dashboard wrongly.
 */
export function TrendArrow({ direction, good, label, className }: {
  direction: "up" | "down" | "flat"; good?: boolean; label?: string; className?: string;
}) {
  const glyph = { up: "↑", down: "↓", flat: "→" }[direction];
  const isGood = good ?? direction === "up";
  const tone = direction === "flat" ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive";
  return (
    <span className={cn("inline-flex items-center", tone, className)}>
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{label ?? { up: "Up", down: "Down", flat: "No change" }[direction]}</span>
    </span>
  );
}
