import { cn } from "@/lib/utils";
/**
 * "Busiest around 5pm on Fridays" — when to expect a rush.
 *
 * IT IS ADVICE, NOT ANALYTICS. A heat map of every hour is a chart somebody has
 * to read; one sentence naming the busiest window is the thing a customer acts
 * on by coming at a different time, and the thing an owner acts on by putting
 * somebody else on shift.
 *
 * THE QUIET WINDOW IS AS USEFUL AS THE BUSY ONE and is the half always omitted.
 * For a customer it is the whole point — "quietest before 11" is a
 * recommendation, where "busiest at 5" is only a warning.
 *
 * IT SAYS WHAT THE CLAIM IS BASED ON. "Usually" is doing real work here: this
 * is a pattern from past weeks, not a promise about today, and a component
 * asserting it flatly will be wrong on the day of a bank holiday.
 *
 * NO NUMBERS UNLESS THE CALLER HAS THEM. "3.4× the average" is a precision
 * that invites arguing with the method; the window is the actionable part.
 */
export function PeakNote({ busiest, quietest, basis, className }: {
  /** "around 5pm on Fridays". */
  busiest?: string;
  /** "before 11am on weekdays". */
  quietest?: string;
  /** What it is from — "the last 8 weeks". */
  basis?: string;
  className?: string;
}) {
  if (!busiest && !quietest) return null;
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {busiest && <span>Usually busiest <span className="text-foreground">{busiest}</span>.</span>}
      {busiest && quietest && " "}
      {quietest && <span>Quietest <span className="text-foreground">{quietest}</span>.</span>}
      {basis && <span className="block text-xs">Based on {basis}.</span>}
    </p>
  );
}
