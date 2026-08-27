import { cn } from "@/lib/utils";
/**
 * How many you need to sell before you stop losing money.
 *
 * THE UNIT COUNT LEADS, not the revenue figure. "£4,800" is an abstraction;
 * "160 covers" or "22 jobs" is a number somebody can hold against a week and
 * decide whether it is achievable.
 *
 * IT SAYS WHEN, not just how many, when the caller can supply a rate. "160
 * covers — about 3 weeks at your current pace" is the sentence that turns a
 * calculation into a plan.
 *
 * ALREADY PAST BREAK-EVEN IS ITS OWN SENTENCE. A counter that keeps counting
 * toward a line already crossed is the sort of thing that makes people distrust
 * the whole page.
 */
export function BreakEvenNote({ units, unitNoun = "sales", revenue, unitLabel = "", atCurrentRate, passed, className }: {
  /** How many more are needed. */
  units: number;
  unitNoun?: string;
  revenue?: number;
  unitLabel?: string;
  /** "about 3 weeks at your current pace". */
  atCurrentRate?: string;
  passed?: boolean;
  className?: string;
}) {
  if (passed) {
    return <p data-slot="break-even-note" className={cn("text-sm font-medium", className)}>Past break-even.</p>;
  }
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-medium tabular-nums">{units.toLocaleString()} more {unitNoun}</span>
      <span className="text-muted-foreground">
        {typeof revenue === "number" ? ` · ${unitLabel}${revenue.toLocaleString()}` : ""}
        {atCurrentRate ? ` · ${atCurrentRate}` : ""}
      </span>
    </p>
  );
}
