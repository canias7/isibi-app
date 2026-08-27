import { cn } from "@/lib/utils";
/**
 * How long the work takes once it starts.
 *
 * Distinct from a deadline and from a lead time: this is the estimate a
 * customer is given at the point of asking — "repairs usually take 3–5 working
 * days" — and it is the single most asked question in every service business.
 *
 * A RANGE, NOT A NUMBER. "3 days" is heard as a promise and produces a complaint
 * on day four; "3–5 working days" sets a band the business can actually hold. A
 * single value is still allowed, for the cases that genuinely are fixed.
 *
 * "WORKING DAYS" IS SAID EXPLICITLY when it is meant, because a customer
 * quoting five days on a Thursday and expecting it Tuesday is the commonest
 * misunderstanding in the whole exchange — and it is invisible in the number.
 *
 * `busyNote` is the honest escape hatch for a period when the estimate does not
 * hold. Leaving the usual figure up during a three-week backlog is how a
 * business earns a bad review it could have avoided with one sentence.
 */
export function TurnaroundNote({ from, to, unit = "working days", busyNote, className }: {
  from: number;
  /** Omit for a fixed figure rather than a range. */
  to?: number;
  unit?: string;
  /** Overrides the estimate while there is a backlog. */
  busyNote?: string;
  className?: string;
}) {
  return (
    <p data-slot="turnaround-note" className={cn("text-sm", className)}>
      <span className="text-muted-foreground">Usually </span>
      <span className="font-medium tabular-nums">
        {to && to !== from ? `${from}–${to}` : from} {unit}
      </span>
      {busyNote && <span className="text-muted-foreground"> · {busyNote}</span>}
    </p>
  );
}
