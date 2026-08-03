import { cn } from "@/lib/utils";

/**
 * A school year, and specifically the days the building is SHUT.
 *
 * THE CLOSURE DAYS ARE THE CONTENT. "Autumn term: 4 September to 20 December"
 * is the sentence every school publishes and it hides the five INSET days and
 * the half-term week inside it — which are precisely the dates a working
 * parent has to arrange childcare around. A term-dates page that requires
 * somebody to cross-reference a second list has not answered the question.
 *
 * So a term carries its closures, they render inside it, and each one says
 * what it is. An INSET day and a bank holiday are both "shut" and a parent
 * needs to plan for both identically, so they are shown identically — the
 * `reason` is there to explain, not to categorise into different treatments.
 *
 * `current` MARKS THE TERM WE ARE IN, by weight and a written word rather than
 * a colour, and it is a prop rather than a computed value for the same reason
 * `TradingDiary` takes `todayIndex`: a component cannot know the site's
 * timezone, and a "current term" that is wrong by one day at midnight in
 * August is worse than no highlight at all.
 *
 * No colour anywhere. This gets printed and stuck to a fridge, which is
 * genuinely the main way it is used.
 */
export type Closure = {
  /** "27 to 31 October" or "5 September". Free text — read, not parsed. */
  when: string;
  /** "Half term", "INSET day", "Bank holiday", "Occasional day". */
  reason: string;
};

export type Term = {
  name: string;
  /** "4 September" */
  from: string;
  /** "19 December" */
  to: string;
  /** Every day inside the term when the building is shut to pupils. */
  closures?: Closure[];
  current?: boolean;
};

export function TermDates({ terms, year, note, className }: {
  terms: Term[];
  /** "2026 to 2027". Printed, because a term-dates page with no year on it is a trap. */
  year: string;
  note?: string;
  className?: string;
}) {
  if (!terms.length) return null;
  return (
    <div className={cn("space-y-6", className)}>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">School year {year}</p>
      <ul className="divide-y divide-border border-y border-border">
        {terms.map((t) => (
          <li key={t.name} className={cn("py-5", t.current && "bg-muted/40 px-4")}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {t.current && (
                <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-background">
                  This term
                </span>
              )}
              <span className={cn(t.current ? "font-semibold" : "font-medium")}>{t.name}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{t.from} – {t.to}</span>
            </div>
            {t.closures?.length ? (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Closed to pupils</p>
                <ul className="mt-1.5 space-y-1">
                  {t.closures.map((c) => (
                    <li key={`${c.when}-${c.reason}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="tabular-nums">{c.when}</span>
                      <span className="text-muted-foreground">{c.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {note && <p className="max-w-prose text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
