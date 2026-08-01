import { cn } from "@/lib/utils";
/**
 * Whether somebody can just turn up, and roughly how long they would wait.
 *
 * "WE TAKE WALK-INS" WITHOUT A WAIT IS HALF AN ANSWER. Somebody deciding
 * whether to walk over needs to know if it is five minutes or an hour, and the
 * absence of a number is read optimistically — which produces the annoyed
 * customer standing in a doorway.
 *
 * "NOT RIGHT NOW" IS DIFFERENT FROM "NEVER", and both are common. A shop that
 * normally takes walk-ins but is full this afternoon should say so and point at
 * booking, rather than showing the same message as one that has never taken
 * them.
 *
 * THE WAIT IS A RANGE OR NOTHING, never a single confident number. Queue length
 * times average job is an estimate with a wide spread, and "about 20 minutes"
 * that turns into 45 is worse than "20 to 40".
 *
 * `role="status"` when it reflects live queue state, since it changes while
 * somebody is deciding.
 */
export function WalkInNote({ accepted, waitFrom, waitTo, reason, action, className }: {
  accepted: "yes" | "not-now" | "no";
  /** Minutes. */
  waitFrom?: number;
  waitTo?: number;
  /** Why not, for "not-now" — "we are fully booked until 4". */
  reason?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const wait = waitFrom === undefined ? null
    : waitTo === undefined || waitTo === waitFrom
      ? `about ${waitFrom} minutes`
      : `${waitFrom} to ${waitTo} minutes`;
  return (
    <p role="status" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      {accepted === "yes" && (
        <span>
          <span className="font-medium">Walk in any time</span>
          {wait && <span className="text-muted-foreground"> · the wait is {wait} right now</span>}
        </span>
      )}
      {accepted === "not-now" && (
        <span>
          <span className="font-medium">No walk-ins right now</span>
          <span className="text-muted-foreground">{reason ? ` — ${reason}` : ""}</span>
        </span>
      )}
      {accepted === "no" && (
        <span>
          <span className="font-medium">By appointment only</span>
        </span>
      )}
      {action}
    </p>
  );
}
