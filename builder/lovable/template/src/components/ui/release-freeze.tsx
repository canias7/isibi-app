import { cn } from "@/lib/utils";
/**
 * "Nothing ships until Monday" — a freeze, with the exception route.
 *
 * THE EXCEPTION ROUTE IS NOT OPTIONAL. A freeze with no stated way to ship an
 * emergency fix produces one of two bad outcomes: the fix waits while something
 * is broken, or somebody ships around the process entirely. Naming who can
 * approve an exception is what keeps a freeze from being ignored.
 *
 * WHAT IS STILL ALLOWED IS LISTED. Most freezes permit documentation changes,
 * configuration, or rollbacks — and a blanket "nothing ships" stops work that
 * was never the risk.
 *
 * THE REASON IS GIVEN, because a freeze somebody understands is one they
 * respect. "Month end" and "a conference on Thursday" are different amounts of
 * flexibility and people can judge accordingly.
 *
 * IT SAYS WHEN IT LIFTS AS A DATE AND TIME, not "next week". A freeze with a
 * vague end is one that quietly extends, and everybody plans around the vaguest
 * possible reading.
 */
export function ReleaseFreeze({ active, until, reason, stillAllowed = [], exceptionVia, className }: {
  active: boolean;
  /** Free text — "Monday 09:00". */
  until?: string;
  /** Why — "month end". */
  reason?: string;
  /** What can still ship. */
  stillAllowed?: string[];
  /** Who approves an exception. */
  exceptionVia?: string;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div role="status"
      className={cn("space-y-1 rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm", className)}>
      <p>
        <span className="font-medium">Releases are frozen{until ? ` until ${until}` : ""}</span>
        {reason && <span className="text-muted-foreground"> — {reason}</span>}
      </p>
      {stillAllowed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Still allowed:{" "}
          {stillAllowed.length === 1
            ? stillAllowed[0]
            : `${stillAllowed.slice(0, -1).join(", ")} and ${stillAllowed[stillAllowed.length - 1]}`}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {exceptionVia
          ? `Something urgent can still go out — ${exceptionVia} can approve it.`
          : "There is no exception route set for this freeze."}
      </p>
    </div>
  );
}
