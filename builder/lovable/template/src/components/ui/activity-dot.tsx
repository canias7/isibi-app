import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The mark on a row saying something changed since you last looked.
 *
 * IT MEANS "NEW TO YOU", not "recent". A row edited an hour ago that you have
 * already seen carries nothing; one edited last week that you have not is
 * marked. Timestamp-based versions mark the same rows for everybody and stop
 * meaning anything after a busy afternoon.
 *
 * IT CLEARS ON VIEW, and the clearing is the caller's to persist — the
 * component does not decide when something has been seen, because "opened" and
 * "read" are different and only the caller knows which it has.
 *
 * `by` names who caused it when that is known. "Changed" is a fact; "Grace
 * changed the price" is a reason to look.
 *
 * A dot alone is invisible to a screen reader, so there is always `sr-only`
 * text — the same rule `hint-dot` and `status-dot` follow.
 */
export function ActivityDot({ unseen, by, what, className }: {
  unseen?: boolean;
  by?: React.ReactNode;
  what?: React.ReactNode;
  className?: string;
}) {
  if (!unseen) return null;
  return (
    <span data-slot="activity-dot" className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-foreground" />
      {by || what ? (
        <span className="text-xs text-muted-foreground">
          {by ? <strong className="font-medium text-foreground">{by}</strong> : null}
          {by && what ? " " : null}
          {what}
        </span>
      ) : null}
      <span className="sr-only">New since you last looked</span>
    </span>
  );
}
