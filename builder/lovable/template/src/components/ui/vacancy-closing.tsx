import { cn } from "@/lib/utils";
/**
 * How long is left to apply — honestly.
 *
 * IT DISTINGUISHES CLOSING FROM CLOSED-EARLY. Adverts are pulled when enough
 * applications arrive, and a candidate part-way through a long form deserves to
 * be told that rather than to submit into nothing.
 *
 * COUNTDOWNS ARE IN DAYS, NOT HOURS OR SECONDS. A ticking clock on a job advert
 * is a pressure device; the deadline is a fact, and days is the resolution
 * anybody actually plans in.
 *
 * IT SAYS WHETHER APPLICATIONS ARE REVIEWED AS THEY ARRIVE. On a rolling
 * advert the real deadline was two weeks ago, and this is the single most
 * useful thing to tell somebody looking at "14 days left".
 *
 * A CLOSED ADVERT STAYS READABLE. People arrive from search and old links, and
 * a removed page tells them nothing about whether to look again.
 */
export function VacancyClosing({ closesOn, daysLeft, closed, closedEarly, rollingReview, nextRoundNote, className }: {
  /** Free text — "14 August". */
  closesOn?: string;
  daysLeft?: number;
  closed?: boolean;
  /** True where it was pulled before its date. */
  closedEarly?: boolean;
  rollingReview?: boolean;
  /** "We advertise this most quarters." */
  nextRoundNote?: string;
  className?: string;
}) {
  const soon = !closed && daysLeft !== undefined && daysLeft <= 3;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(soon && "font-medium")}>
        {closed
          ? closedEarly
            ? "Closed early — we had enough applications."
            : `Closed${closesOn ? ` on ${closesOn}` : ""}.`
          : daysLeft !== undefined
            ? daysLeft === 0 ? "Closes today." : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left to apply.`
            : closesOn ? `Closes ${closesOn}.` : "No closing date."}
      </p>
      {!closed && closesOn && daysLeft !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">Closing date {closesOn}.</p>
      )}
      {!closed && rollingReview && (
        <p className="text-xs font-medium">
          Applications are read as they arrive, so the real deadline is earlier than this one.
        </p>
      )}
      {closed && nextRoundNote && <p className="text-xs">{nextRoundNote}</p>}
    </div>
  );
}
