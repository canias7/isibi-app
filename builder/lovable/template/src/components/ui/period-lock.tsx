import { cn } from "@/lib/utils";
/**
 * A closed accounting period — and what that actually prevents.
 *
 * IT SAYS WHAT IS STILL POSSIBLE. A lock that reads as absolute makes people
 * assume a correction is impossible and post it into the current period
 * instead, which is worse — the figures are wrong in two periods rather than
 * one. Naming the proper route is the whole point.
 *
 * WHO CAN UNLOCK IT IS NAMED. An anonymous restriction is worked around; a
 * named person is asked.
 *
 * WHY IT IS LOCKED MATTERS. A period closed pending a review is a different
 * conversation from one closed because a return has been filed against it, and
 * only the second is genuinely immovable.
 *
 * THE DATE IS THE BOUNDARY AND IS SHOWN AS ONE. "Locked up to and including 31
 * March" is unambiguous; "March is locked" is not, on the last day of it.
 */
export function PeriodLock({ lockedUpTo, reason, unlockableBy, filedReturn, correctionRoute, className }: {
  /** Free text — "31 March 2026". */
  lockedUpTo: string;
  /** Why — "the VAT return for this quarter has been filed". */
  reason?: string;
  unlockableBy?: string;
  /** True where a return has been filed against it. */
  filedReturn?: boolean;
  /** How to correct something inside it properly. */
  correctionRoute?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">Locked up to and including {lockedUpTo}</p>
      {reason && <p className="text-xs">{reason}</p>}
      <p className="text-xs">
        {correctionRoute ??
          "To correct something inside it, post an adjustment dated after the lock — do not backdate it into the open period."}
      </p>
      <p className="text-xs text-muted-foreground">
        {filedReturn
          ? "A return has been filed against this period, so changing it means amending the return."
          : unlockableBy
            ? `${unlockableBy} can unlock it if there is a good reason.`
            : "Nobody is recorded as able to unlock this."}
      </p>
    </div>
  );
}
