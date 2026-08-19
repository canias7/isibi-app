import { cn, toDate } from "@/lib/utils";
/**
 * A meeting, and whether its papers are actually out yet.
 *
 * AN AGENDA IS DUE THREE CLEAR DAYS BEFORE A MEETING and a bare date tells a
 * resident nothing about whether they can prepare. "Agenda not published yet,
 * due by Friday" is information; "Tuesday 12 August, 7pm" is a save-the-date
 * for a meeting nobody can arrive at knowing what will be discussed — which is
 * how public meetings end up attended by nobody but the people running them.
 *
 * THE DUE DATE IS DERIVED FROM THE MEETING DATE, not stored. Three clear days
 * excludes the day of publication and the day of the meeting, which is the bit
 * everyone gets wrong by one — and a stored due date drifts the moment a
 * meeting is moved, which is exactly when it matters.
 *
 * LATE IS SAID OUT LOUD. Once the deadline has passed with nothing published,
 * the row says so rather than continuing to promise. A council that is late is
 * a council somebody should be able to see is late, and softening that is
 * taking the clerk's side over the resident's.
 *
 * MINUTES ARE A SEPARATE STATE FROM AGENDA, and DRAFT is a third. Minutes are
 * not approved until the following meeting, so "draft" is the honest label for
 * six weeks and calling them minutes is a small lie that matters the one time
 * somebody quotes them.
 *
 * NO COLOUR. Out, due, late and draft are words at different weights, because
 * this gets printed and pinned to a noticeboard about as often as it is read on
 * a screen.
 */
export type Meeting = {
  /** ISO date of the meeting: "2026-08-12". */
  date: string;
  /** "19:30". */
  time?: string | null;
  /** "Full council", "Planning committee", "Annual parish meeting". */
  kind: string;
  where?: string | null;
  agendaHref?: string | null;
  minutesHref?: string | null;
  /** Minutes not yet approved by the following meeting. The honest label. */
  minutesDraft?: boolean;
  note?: string | null;
};
export function MeetingPapers({
  meetings, noticeDays = 3, locale = "en-GB", now, heading = "Meetings and papers", note, className,
}: {
  meetings: Meeting[];
  /** Statutory clear days' notice. Three for an English parish council. */
  noticeDays?: number;
  locale?: string;
  /** Injectable clock, so a test can fix "today". */
  now?: Date;
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!meetings.length) return null;
  const today = now ?? new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const fmt = (d: Date) => d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" });
  const sorted = [...meetings]
    .filter((m) => !Number.isNaN(toDate(m.date).getTime()))
    .sort((a, b) => +toDate(b.date) - +toDate(a.date));
  return (
    <div className={cn("", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {sorted.map((m) => {
          const when = toDate(m.date);
          const past = when.getTime() < midnight;
          // DERIVED, not stored — a stored due date drifts the moment a meeting
          // is moved, which is precisely when somebody is relying on it.
          const due = toDate(when);
          due.setDate(due.getDate() - (noticeDays + 1));
          const overdue = !m.agendaHref && !past && due.getTime() < midnight;
          return (
            <li key={`${m.date}-${m.kind}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4">
              <span className="min-w-0 flex-1">
                <span className={cn("text-base", past ? "text-muted-foreground" : "font-medium")}>
                  {m.kind}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {fmt(when)}{m.time ? `, ${m.time}` : ""}{m.where ? ` · ${m.where}` : ""}
                </span>
                {m.note && <span className="block text-sm leading-relaxed text-muted-foreground">{m.note}</span>}
              </span>
              {/* max-w so a long status cannot consume the row: `shrink-0`
                  alone lets the widest state decide the whole layout. */}
              <span className="shrink-0 max-w-[13rem] text-end">
                {/* AGENDA. Out, due, or LATE — and late is said rather than
                    softened, because a resident is the one it costs. */}
                {m.agendaHref ? (
                  <a className="block text-sm font-medium underline underline-offset-4" href={m.agendaHref}>Agenda</a>
                ) : past ? (
                  <span className="block text-sm text-muted-foreground">No agenda filed</span>
                ) : overdue ? (
                  /* TWO LINES, like every other state here. As one string it is
                     long enough that `shrink-0` lets it eat the row and
                     collapses the meeting name to a ribbon — measured. */
                  <>
                    <span className="block text-sm font-medium">Agenda overdue</span>
                    <span className="block text-sm text-muted-foreground">It was due {fmt(due)}</span>
                  </>
                ) : (
                  <span className="block text-sm text-muted-foreground">Agenda due by {fmt(due)}</span>
                )}
                {m.minutesHref ? (
                  <a className="mt-0.5 block text-sm underline underline-offset-4" href={m.minutesHref}>
                    {m.minutesDraft ? "Draft minutes" : "Minutes"}
                  </a>
                ) : past ? (
                  <span className="mt-0.5 block text-sm text-muted-foreground">Minutes not up yet</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}