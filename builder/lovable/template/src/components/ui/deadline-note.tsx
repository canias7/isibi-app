import { DateFormat } from "@/components/ui/date-format";
import { TimeSince } from "@/components/ui/time-since";
import { cn } from "@/lib/utils";
/**
 * When it is due, and whether that is a problem yet.
 *
 * THREE STATES IN WORDS: due, due soon, overdue. Not three colours — a red date
 * is invisible in greyscale, means nothing to a screen reader, and is the
 * commonest form of colour blindness. "Overdue by 2 days" says the same thing
 * to everybody.
 *
 * "SOON" IS THE CALLER'S THRESHOLD, in hours, because what counts as soon is
 * entirely domain-specific: a day for an invoice, an hour for a kitchen ticket,
 * a month for a certificate. A component that picked would be wrong most of the
 * time.
 *
 * The absolute date is always present alongside the relative one. "Overdue by 2
 * days" is the judgement; "3 August" is the fact somebody needs to act on, and
 * dropping it for the friendlier phrasing is how people end up hovering to find
 * out what day it actually is.
 */
export function DeadlineNote({ due, soonWithinHours = 24, done, className }: {
  due: string | number | Date;
  /** How many hours ahead counts as "soon". */
  soonWithinHours?: number;
  /** Already finished — no urgency, just the date. */
  done?: boolean;
  className?: string;
}) {
  const at = new Date(due).getTime();
  if (Number.isNaN(at)) return null;
  const left = at - Date.now();
  const overdue = !done && left < 0;
  const soon = !done && left >= 0 && left <= soonWithinHours * 3_600_000;

  return (
    <p className={cn("text-sm", className)}>
      <span className={cn(overdue || soon ? "font-medium" : "text-muted-foreground")}>
        {done ? "Was due" : overdue ? "Overdue" : soon ? "Due soon" : "Due"}
      </span>{" "}
      <DateFormat date={at} withTime />
      {!done && (
        <span className="text-muted-foreground"> · <TimeSince at={at} /></span>
      )}
    </p>
  );
}
