import { cn } from "@/lib/utils";
/**
 * The moving date — with hoped-for and agreed kept apart.
 *
 * A TARGET AND AN AGREED DATE ARE COMPLETELY DIFFERENT THINGS AND ARE ROUTINELY
 * SHOWN IN ONE FIELD. People book removals, hand in notice and take days off work
 * against a date nobody has committed to; the component states which kind this is
 * before it states the date.
 *
 * EVERYBODY WHO HAS TO AGREE IS LISTED, and the ones who have not are named.
 * In a chain a date is agreed by everyone or by nobody, and "pending" hides
 * whether that means one link or five.
 *
 * A CHANGED DATE KEEPS THE OLD ONE VISIBLE. Somebody has arranged their life
 * around the previous date, and a field that silently overwrites is how they
 * find out on the day.
 *
 * NO COUNTDOWN ON AN UNAGREED DATE. A ticking clock on a target reads as
 * certainty, which is the exact misunderstanding this component exists to stop.
 */
export function CompletionDate({ date, agreed, agreedBy = [], waitingOn = [], previousDate, changedBecause, daysAway, className }: {
  date?: string;
  /** Agreed by everyone, or it is a target. */
  agreed?: boolean;
  agreedBy?: string[];
  /** Named, not counted. */
  waitingOn?: string[];
  previousDate?: string;
  changedBecause?: string;
  /** Only shown once agreed. */
  daysAway?: number;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        {agreed ? "Agreed date" : "Target date — not agreed by everyone yet"}
      </p>
      <p className="text-lg font-medium">{date ?? "No date proposed"}</p>
      {agreed && daysAway !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {daysAway === 0 ? "Today." : `${daysAway} ${daysAway === 1 ? "day" : "days"} away.`}
        </p>
      )}
      {!agreed && waitingOn.length > 0 && (
        <p className="text-xs font-medium">
          Waiting on {AND.format(waitingOn)}. Do not book anything against this yet.
        </p>
      )}
      {agreedBy.length > 0 && (
        <p className="text-xs text-muted-foreground">Agreed by {AND.format(agreedBy)}.</p>
      )}
      {previousDate && (
        <p className="text-xs">
          Was {previousDate}
          {changedBecause ? ` — ${changedBecause.replace(/\s*[.!?]\s*$/, "")}` : ""}. Anybody who arranged something
          around that needs telling.
        </p>
      )}
    </div>
  );
}
