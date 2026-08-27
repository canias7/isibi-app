import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Between Tuesday and Thursday" — a range, because that is the truth.
 *
 * A SINGLE ESTIMATED DATE IS A PROMISE NOBODY MADE. Carriers give windows,
 * and collapsing a window to its optimistic end is how a shop generates its
 * own complaints. The type takes `from` and `to`; a single date has to be
 * passed as a range of one, deliberately.
 *
 * IT DEGRADES AS THE DATE PASSES rather than freezing: past the window it
 * says how late it is and stops pretending, which is the deadline-bar rule
 * applied to somebody else's van.
 *
 * "TODAY" AND "TOMORROW" ARE SPELLED OUT, because a weekday name near the
 * present is read slower than the word.
 */
export function DeliveryEta({ from, to, now, className }: {
  from: Date;
  to: Date;
  now?: Date;
  className?: string;
}) {
  const at = now ?? new Date();
  const day = (d: Date) => {
    const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((midnight(d) - midnight(at)) / 864e5);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff === -1) return "yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  };
  const late = at.getTime() > to.getTime();
  const days = Math.floor((at.getTime() - to.getTime()) / 864e5);

  if (late) {
    return (
      <p data-slot="delivery-eta" className={cn("text-sm font-medium", className)}>
        Expected by {day(to)} — {days < 1 ? "later than expected" : `${days} day${days === 1 ? "" : "s"} late`}.
        <span className="block text-xs font-normal text-muted-foreground">
          Carriers usually catch up within a day. If it has been longer, tell us.
        </span>
      </p>
    );
  }
  const same = day(from) === day(to);
  return (
    <p className={cn("text-sm", className)}>
      {same ? <>Arriving <b>{day(to)}</b></> : <>Arriving between <b>{day(from)}</b> and <b>{day(to)}</b></>}
      <span className="block text-xs text-muted-foreground">An estimate from the carrier, not a guaranteed date.</span>
    </p>
  );
}
