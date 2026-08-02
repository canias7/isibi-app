import { cn } from "@/lib/utils";
/**
 * When we meet — this week, not a static weekly grid.
 *
 * THE ONE-OFF CHANGE IS THE WHOLE REASON THIS EXISTS. A congregation's site
 * that prints "Sunday 10:30" every week is wrong four or five times a year —
 * the carol service, the joint service, the week the heating failed — and those
 * are precisely the weeks a visitor turns up to a locked door. A `note` on a
 * time overrides it visibly rather than replacing it silently.
 *
 * `cancelled` strikes the row through AND says so in words, because a line
 * through text is not announced by a screen reader and is invisible in print.
 *
 * WHEN EVERY ROW IS THE SAME DAY, THE DAY COLUMN GOES. An attraction's daily
 * timetable is eleven rows all saying "Every day" down the left — a constant
 * dressed as a field, taking a quarter of the width and telling nobody
 * anything, while the heading above already says it. A schedule spanning real
 * days keeps the column, which is the case it was built for.
 */
export type Meeting = {
  day: string;
  time: string;
  what: string;
  where?: string | null;
  /** A change this week only — printed as a change, not folded into the time. */
  note?: string | null;
  cancelled?: boolean;
};
export function ServiceTimes({ meetings, heading = "This week", className }: {
  meetings: Meeting[]; heading?: string; className?: string;
}) {
  if (!meetings.length) return null;
  // A column whose every cell is identical is not a field, and the heading has
  // already said it. Kept the moment two real days appear.
  const manyDays = meetings.some((m) => m.day !== meetings[0].day);
  return (
    <div className={cn("", className)}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</p>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {meetings.map((m, i) => (
          <li key={`${m.day}-${m.time}-${i}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
            {manyDays && <span className="w-24 shrink-0 text-sm font-medium">{m.day}</span>}
            <span className={cn("w-20 shrink-0 text-sm tabular-nums", m.cancelled && "line-through")}>{m.time}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("text-sm", m.cancelled ? "text-muted-foreground line-through" : "font-medium")}>
                {m.what}
              </span>
              {m.where && <span className="block text-sm text-muted-foreground">{m.where}</span>}
              {m.cancelled && <span className="block text-sm font-medium">Not on this week</span>}
              {m.note && !m.cancelled && (
                <span className="mt-0.5 block text-sm font-medium">{m.note}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
