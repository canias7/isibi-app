import { cn } from "@/lib/utils";
/**
 * Reporting a bin that was not emptied — with the window that decides it.
 *
 * THE REPORTING WINDOW IS THE FIRST THING SHOWN. Most services will only accept
 * a report within a day or two, and somebody discovering that after the window
 * has passed has been made to fill in a form for nothing. Stating it up front is
 * the respectful version.
 *
 * IT ASKS WHETHER THE BIN WAS OUT IN TIME, plainly and without accusation. It
 * is the single most common reason a collection is genuinely missed, the answer
 * decides the outcome, and a form that avoids asking gets a report that is
 * rejected without explanation.
 *
 * A WHOLE-STREET MISS IS DIFFERENT FROM ONE BIN. The first is a failed round
 * already known to the depot, and telling somebody that saves both a report and
 * a wait.
 *
 * IT SAYS WHAT HAPPENS NEXT AND BY WHEN. "We will investigate" is not an
 * outcome; "we return within two working days, or it waits for the next
 * collection" is one somebody can plan around.
 */
export function MissedCollection({ bin, dueOn, reportWithinDays, windowClosed, wasOutInTime, wholeStreet, outcomeNote, className }: {
  bin?: string;
  /** Free text — "Thursday 14 August". */
  dueOn?: string;
  /** How long a report is accepted for. */
  reportWithinDays?: number;
  /** True where it is now too late to report. */
  windowClosed?: boolean;
  /** The answer to the question that decides the outcome. */
  wasOutInTime?: boolean;
  /** True where the whole round failed. */
  wholeStreet?: boolean;
  /** What happens and by when. */
  outcomeNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="missed-collection" className={cn("space-y-0.5 text-sm", className)}>
      {wholeStreet ? (
        <p className="font-medium">
          We already know — the whole round was missed. There is no need to report it.
        </p>
      ) : windowClosed ? (
        <p className="font-medium">
          It is now too late to report this one{reportWithinDays !== undefined ? `, which we accept for ${reportWithinDays} ${reportWithinDays === 1 ? "day" : "days"}` : ""}.
        </p>
      ) : (
        <p>
          {bin ? `Report a missed ${bin}` : "Report a missed collection"}
          {dueOn && <span className="text-muted-foreground"> · due {dueOn}</span>}
        </p>
      )}
      {!windowClosed && !wholeStreet && reportWithinDays !== undefined && (
        <p className="text-xs font-medium">
          Report it within {reportWithinDays} working {reportWithinDays === 1 ? "day" : "days"} or we cannot act on it.
        </p>
      )}
      {!wholeStreet && wasOutInTime === false && (
        <p className="text-xs">
          You have told us the bin was not out in time. We will not return for this one, but say so anyway if you think that is wrong.
        </p>
      )}
      {!wholeStreet && wasOutInTime === undefined && !windowClosed && (
        <p className="text-xs text-muted-foreground">
          We will ask whether the bin was out before the crew came. It decides the outcome, so it is worth answering honestly.
        </p>
      )}
      {outcomeNote && <p className="text-xs">{outcomeNote}</p>}
    </div>
  );
}
