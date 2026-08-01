import { cn } from "@/lib/utils";
/**
 * A site safety briefing — topic, who attended, and who did not.
 *
 * WHO WAS ABSENT IS THE RECORD THAT MATTERS. A talk with an attendance list
 * looks complete; the useful question is which of the people on site that day
 * missed it, because they are the ones who have not been briefed and are
 * working anyway.
 *
 * IT IS THE EVIDENCE, so it carries who delivered it and when. Attendance
 * sheets are produced in investigations and after incidents, and one with no
 * presenter and no date proves nothing.
 *
 * THE TOPIC IS SPECIFIC. "Safety" is a talk nobody remembers; "working near the
 * live edge on level 3" is one that changes behaviour that afternoon — and it
 * is what makes the record meaningful later.
 *
 * A LANGUAGE NOTE, because a briefing delivered only in English on a site where
 * it is not everybody's first language has been given and not received. Saying
 * how it was delivered is honest.
 */
export function ToolboxTalk({ topic, date, by, attended = [], absent = [], languages = [], className }: {
  topic: string;
  /** ISO date. */
  date?: string;
  by?: string;
  attended?: string[];
  /** On site that day and not at the talk. */
  absent?: string[];
  /** How it was delivered. */
  languages?: string[];
  className?: string;
}) {
  const d = date ? new Date(date) : null;
  const ok = d && !Number.isNaN(d.getTime());
  return (
    <article className={cn("space-y-1 rounded-md border border-border p-3 text-sm", className)}>
      <p className="font-medium">{topic}</p>
      <p className="text-xs text-muted-foreground">
        {by ? `Given by ${by}` : "Presenter not recorded"}
        {ok && (
          <> · <time dateTime={date}>{d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></>
        )}
        {languages.length > 0 && ` · delivered in ${languages.join(" and ")}`}
      </p>
      <p className="text-xs">
        <span className="text-muted-foreground">Attended: </span>
        <span className="tabular-nums">{attended.length}</span>
      </p>
      {absent.length > 0 && (
        <p className="text-xs">
          <span className="font-medium">{absent.length} on site did not attend</span>
          <span className="block text-muted-foreground">{absent.join(", ")}</span>
        </p>
      )}
    </article>
  );
}
