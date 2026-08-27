import { cn } from "@/lib/utils";
/**
 * What a service promises, against what it is currently doing.
 *
 * THE ACTUAL PERFORMANCE SITS BESIDE THE PROMISE OR THE PROMISE IS MARKETING.
 * "We answer within 10 working days" is a commitment; "we answer within 10
 * working days, and last month 62% of us did" is information. Publishing only
 * the first is how a standard survives years of not being met.
 *
 * THE MEASURE IS NAMED — median, 90th percentile, or the share within target.
 * An average wait is dominated by the tail and describes almost nobody's
 * experience; a share-within-target says nothing about how bad the misses were.
 * Which one is being quoted changes the meaning entirely.
 *
 * WHAT HAPPENS WHEN IT IS MISSED IS PART OF THE STANDARD. A promise with no
 * remedy is a statement of intent, and the escalation route is the only thing
 * that makes it operative for the person waiting.
 *
 * THE PERIOD IS SHOWN, because a figure with no date attached is a figure
 * nobody has to update.
 */
export function ServiceStandard({ standard, target, achieved, measure = "within target", period, ifMissed, className }: {
  /** What is promised, in words. */
  standard: string;
  /** The target, pre-formatted — "10 working days". */
  target?: string;
  /** Share achieved, 0–1. */
  achieved?: number;
  /** How it is measured. */
  measure?: string;
  /** Free text — "in July". */
  period?: string;
  /** The remedy or escalation route. */
  ifMissed?: string;
  className?: string;
}) {
  const pct = achieved !== undefined
    ? new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 }).format(achieved)
    : undefined;
  const short = achieved !== undefined && achieved < 0.9;
  return (
    <div data-slot="service-standard" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {standard}
        {target && <span className="text-muted-foreground"> — {target}</span>}
      </p>
      {pct && (
        <p className={cn("text-xs tabular-nums", short ? "font-medium" : "text-muted-foreground")}>
          {pct} {measure}
          {period && ` ${period}`}
        </p>
      )}
      {ifMissed ? (
        <p className="text-xs">If we miss it: {ifMissed}</p>
      ) : (
        <p className="text-xs text-muted-foreground">No remedy is published for missing this.</p>
      )}
    </div>
  );
}
