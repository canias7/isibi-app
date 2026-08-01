import { cn } from "@/lib/utils";
/**
 * When a plan was last looked at, and when it is next due.
 *
 * A CHANGE IN CIRCUMSTANCES BEATS THE CALENDAR, and the component says so
 * whenever one is flagged. The scheduled review is a backstop for plans nobody
 * is thinking about; a plan that has stopped fitting needs looking at this week,
 * not in November.
 *
 * "REVIEWED" IS NOT THE SAME AS "CHANGED" and both are shown. A plan reviewed
 * four times with no change is either genuinely stable or has been rubber-stamped
 * four times, and only the pair of numbers can raise the question.
 *
 * OVERDUE IS COUNTED IN WHOLE DAYS AND NEVER ROUNDED TO A CATEGORY. "Slightly
 * overdue" is how eleven months becomes acceptable; a number does not soften.
 *
 * NO AUTOMATIC EXTENSION. Nothing here quietly pushes the date out because the
 * review did not happen — the whole value of the date is that it stops moving.
 */
export function ReviewDue({ lastReviewedOn, dueInDays, timesReviewed, timesChanged, circumstancesChanged, changeNote, className }: {
  lastReviewedOn?: string;
  /** Negative means overdue. */
  dueInDays?: number;
  timesReviewed?: number;
  /** Reviewed and changed are different facts. */
  timesChanged?: number;
  /** Beats the calendar. */
  circumstancesChanged?: boolean;
  changeNote?: string;
  className?: string;
}) {
  const overdue = dueInDays !== undefined && dueInDays < 0;
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {circumstancesChanged ? (
        <p className="font-medium">
          Something has changed{changeNote ? ` — ${changeNote.replace(/\s*[.!?]\s*$/, "")}` : ""}. Look at this now
          rather than waiting for the review date.
        </p>
      ) : dueInDays !== undefined ? (
        <p className={cn("tabular-nums", overdue ? "font-medium" : "")}>
          {overdue ? `Review overdue by ${days(-dueInDays)}.` : `Review due in ${days(dueInDays)}.`}
        </p>
      ) : (
        <p className="font-medium">No review date set.</p>
      )}
      {lastReviewedOn && (
        <p className="text-xs text-muted-foreground">Last looked at {lastReviewedOn}.</p>
      )}
      {timesReviewed !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Reviewed {timesReviewed} {timesReviewed === 1 ? "time" : "times"}
          {timesChanged !== undefined ? `, changed ${timesChanged}` : ""}.
        </p>
      )}
      {timesReviewed !== undefined && timesChanged === 0 && timesReviewed >= 3 && (
        <p className="text-xs">
          Reviewed {timesReviewed} times and never changed. Either it fits perfectly or nobody is really reading it.
        </p>
      )}
    </div>
  );
}
