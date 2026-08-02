import { cn } from "@/lib/utils";
/**
 * Which sessions run on which day, and whether there is room.
 *
 * ONE BLOCK PER DAY, not a days × sessions matrix. The matrix is the obvious
 * shape and it is unreadable on a phone, where most of this is read — and it
 * answers a question nobody asks. A parent asks "what is on on a Tuesday",
 * which is a day and its sessions, in that order.
 *
 * PLACES ARE STATED AS A NUMBER AND A WORD, never a coloured dot. "2 places
 * left" and "Full" both survive greyscale, a bright phone screen and a printout
 * pinned to a fridge; a green circle beside an amber one does not. Full is also
 * struck through AND worded, the same discipline `tap-list` uses for a beer
 * that has gone.
 *
 * FUNDED HOURS ARE SHOWN ON THE SESSION THEY COVER. Every nursery site in the
 * country prints session times, then a paragraph about the 15 and 30 hour
 * entitlements, and leaves the parent to work out which of their sessions are
 * actually free. Marking the session is the whole point of the component: it
 * turns a footnote into an answer.
 *
 * `placesLeft` UNDEFINED IS "Ask us", NOT ZERO. A nursery that has not updated
 * its numbers this week has not thereby closed, and rendering an unknown as
 * Full turns a stale field into a lost enquiry.
 */
export type NurserySession = {
  name: string;
  /** Already formatted: "08:00" / "13:00". */
  from: string;
  to: string;
  /** Omit when it is not known — that renders as "Ask us", not as full. */
  placesLeft?: number | null;
  /** True when the entitlement covers this session. */
  funded?: boolean;
  note?: string | null;
};
export function SessionTable({ days, fundedLabel = "Funded hours cover this", className }: {
  days: { day: string; sessions: NurserySession[] }[];
  /** Name the scheme if the setting wants to: "15 & 30 hours cover this". */
  fundedLabel?: string;
  className?: string;
}) {
  if (!days.length) return null;
  return (
    <div className={cn("grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {days.map((d) => (
        <section key={d.day}>
          <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">{d.day}</h3>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {d.sessions.map((s) => {
              const full = s.placesLeft === 0;
              const known = typeof s.placesLeft === "number";
              return (
                <li key={s.name + s.from} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn("text-sm font-medium", full && "line-through")}>{s.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{s.from}–{s.to}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className={cn(full || (known && s.placesLeft! <= 2) ? "font-medium" : "text-muted-foreground")}>
                      {full ? "Full" : known ? `${s.placesLeft} place${s.placesLeft === 1 ? "" : "s"} left` : "Ask us"}
                    </span>
                    {s.funded && <span className="text-muted-foreground">{fundedLabel}</span>}
                  </div>
                  {s.note && <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
