import * as React from "react";
import { cn, toDate } from "@/lib/utils";
/**
 * How long is left to send it back — counted from the right date.
 *
 * THE CLOCK STARTS AT DELIVERY, NOT AT ORDER. Counting from the order date
 * quietly shortens the window by however long the carrier took, which is
 * both wrong and, in much of the world, unlawful. `deliveredOn` is required
 * by the type for that reason.
 *
 * IT SAYS THE DEADLINE AND THE DAYS LEFT. "14 days to return" needs mental
 * arithmetic against a delivery date somebody has forgotten; "until Friday
 * 12 September — 9 days left" does not.
 *
 * AN EXPIRED WINDOW SAYS WHAT IS STILL POSSIBLE. Faulty goods usually have
 * separate rights that outlast the change-of-mind window, and a flat "return
 * window closed" sends people away with a legitimate claim.
 */
export function ReturnWindow({ deliveredOn, days = 14, now, faultyNote = true, className }: {
  deliveredOn: Date | string;
  days?: number;
  now?: Date;
  faultyNote?: boolean;
  className?: string;
}) {
  const start = toDate(deliveredOn);
  // CALENDAR DAYS, not 24-hour blocks. Adding `days * 864e5` is an hour out
  // across a DST boundary, and for a delivery timestamped near midnight that
  // hour moves the deadline onto the previous or the next DAY — a return
  // window a business would have to honour, stated wrongly. `setDate` is the
  // one arithmetic that stays on the same local clock time.
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + days);
  const at = now ?? new Date();
  const left = Math.ceil((deadline.getTime() - at.getTime()) / 864e5);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  if (left <= 0) {
    return (
      <p data-slot="return-window" className={cn("text-xs", className)}>
        <span className="font-medium">The {days}-day return window closed on {fmt(deadline)}.</span>
        {faultyNote ? (
          <span className="block text-muted-foreground">
            If it is faulty or not as described, that is separate and still applies — tell us.
          </span>
        ) : null}
      </p>
    );
  }
  return (
    <p className={cn("text-xs", className)}>
      Return it until <b>{fmt(deadline)}</b> — <span className="tabular-nums">{left} day{left === 1 ? "" : "s"}</span> left.
      <span className="block text-muted-foreground">Counted from delivery, not from when you ordered.</span>
    </p>
  );
}
