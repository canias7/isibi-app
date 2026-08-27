import { cn } from "@/lib/utils";
/**
 * Time left against a promise.
 *
 * BREACHED IS STATED IN WORDS AND KEEPS COUNTING. A clock that stops at zero
 * hides how badly a promise was missed, and "4 hours over" is the number that
 * decides whether this is a nudge or an apology.
 *
 * PAUSED IS A REAL STATE. Most service promises stop while waiting on the
 * customer, and a clock that keeps running through that produces breach figures
 * nobody trusts — which is how the whole measure gets ignored.
 *
 * Words rather than colour throughout: "2 hours left", "due soon", "4 hours
 * over" all read in greyscale and to a screen reader, where a red pill says
 * nothing to either.
 */
export function SlaClock({ remaining, breached, paused, pausedReason, target, className }: {
  /** "2 hours" — the caller counts it. */
  remaining?: string;
  /** "4 hours" over, when breached. */
  breached?: string;
  paused?: boolean;
  /** Why it is paused — "waiting on the customer". */
  pausedReason?: string;
  /** What was promised — "response within 4 hours". */
  target?: string;
  className?: string;
}) {
  return (
    <p data-slot="sla-clock" role="status" className={cn("text-sm", className)}>
      <span className={cn(breached || !remaining ? "font-medium" : undefined)}>
        {breached ? `${breached} over` : paused ? "Paused" : remaining ? `${remaining} left` : "No target"}
      </span>
      <span className="text-muted-foreground">
        {paused && pausedReason ? ` — ${pausedReason}` : ""}
        {target ? ` · ${target}` : ""}
      </span>
    </p>
  );
}
