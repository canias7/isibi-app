import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * "You changed this from 2 to 4" — an edited rating, shown as edited.
 *
 * AN EDITED REVIEW THAT LOOKS ORIGINAL IS A SMALL DISHONESTY. Somebody rates a
 * business 2, the business fixes the problem, they raise it to 4 — that is a
 * good outcome and the change is the most informative part of it. Hiding the
 * edit also hides the opposite case, where a score was quietly raised after a
 * conversation nobody else saw.
 *
 * IT SHOWS DIRECTION IN WORDS AND AN ARROW, never colour. "Raised" and
 * "lowered" carry the meaning; a green up-arrow says nothing in greyscale and
 * nothing at all to a screen reader.
 *
 * IT NEVER JUDGES A DIRECTION. A lowered rating is not a failure state and is
 * not styled as one — the component reports, and whoever reads it decides.
 *
 * ONLY THE LATEST CHANGE, not a full history. A review edited five times is a
 * different problem, and a component quietly displaying every draft somebody
 * wrote is a privacy surprise rather than transparency.
 */
export function RatingChanged({ from, to, at, note, className }: {
  from: number;
  to: number;
  /** ISO date-time of the change. */
  at?: string;
  note?: string;
  className?: string;
}) {
  if (from === to) return null;
  const up = to > from;
  const d = at ? toDate(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span aria-hidden="true">{up ? "↑" : "↓"} </span>
      {up ? "Raised" : "Lowered"} from <span className="tabular-nums">{from}</span> to{" "}
      <span className="tabular-nums text-foreground">{to}</span>
      {ok && (
        <>
          {" · "}
          <time dateTime={isoAttr(d)}>
            {d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </time>
        </>
      )}
      {note && <span className="block">{note}</span>}
    </p>
  );
}
