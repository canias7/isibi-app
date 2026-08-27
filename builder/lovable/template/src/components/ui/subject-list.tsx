import { cn } from "@/lib/utils";
/**
 * Subjects by level, with the rate on each — because the rate changes with the
 * level.
 *
 * ONE HOURLY RATE ACROSS A WHOLE TUTORING PAGE IS ALWAYS A FICTION. GCSE maths
 * and A-level further maths are not the same hour of work and nobody charges as
 * though they are, so a headline "£35/hr" is either the lowest number on the
 * page presented as the price, or the highest presented as a deterrent. Putting
 * the rate against the level costs one column and removes the whole
 * conversation.
 *
 * GROUPED BY SUBJECT, WITH THE LEVELS UNDER IT, because a parent arrives
 * knowing the subject and the child's year — never the other way round. Flat,
 * the same subject appears four times and the page reads as a price list rather
 * than as what somebody teaches.
 *
 * A FULL LEVEL SAYS SO IN WORDS AND KEEPS ITS PRICE. Removing the row hides
 * that the tutor teaches it at all, which is the thing somebody was checking;
 * and dropping the price while saying "full" reads as evasion. One tutor is a
 * finite thing and saying so is not a weakness.
 *
 * `exam` IS THE FIELD PARENTS ACTUALLY MATCH ON. AQA and Edexcel further maths
 * are different specifications, and a tutor who names them is telling somebody
 * they have taught the actual paper.
 */
export type Level = {
  /** "GCSE", "A-level", "Year 5", "Grade 1–5". */
  level: string;
  /** Per hour. */
  rate: number;
  /** "AQA, Edexcel, OCR" — what parents match on. */
  exam?: string | null;
  /** "60 or 90 minutes". */
  length?: string | null;
  /** False renders "Full — waiting list" and KEEPS the rate. */
  taking?: boolean;
  note?: string | null;
};
export function SubjectList({
  subjects, currency = "GBP", locale = "en-GB", per = "an hour", className,
}: {
  subjects: { subject: string; blurb?: string | null; levels: Level[] }[];
  currency?: string;
  locale?: string;
  per?: string;
  className?: string;
}) {
  if (!subjects.length) return null;
  // A NON-FINITE RATE IS A DASH, NOT "£NaN". `rate: number` is required by the
  // type, so this looks unreachable — and it is reachable in the one way that
  // matters here: `Row` carries an index signature, so a page mapping a
  // database row whose rate column the owner has not filled in passes
  // `undefined` at runtime and still typechecks. Measured: `rate={undefined}`
  // rendered `£NaN` on the price, which is the most conspicuous thing on the
  // component.
  const money = (n: number) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
      : "—";
  return (
    <div data-slot="subject-list" className={cn("space-y-10", className)}>
      {subjects.map((s) => (
        <section key={s.subject}>
          <h3 className="text-2xl font-semibold tracking-tight">{s.subject}</h3>
          {s.blurb && <p className="mt-1 max-w-prose text-base leading-relaxed text-muted-foreground">{s.blurb}</p>}
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {s.levels.map((l) => {
              const full = l.taking === false;
              return (
                <li key={l.level} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="text-base font-medium">{l.level}</span>
                    {(l.exam || l.length) && (
                      <span className="block text-sm text-muted-foreground">
                        {l.exam}
                        {l.exam && l.length && " · "}
                        {l.length}
                      </span>
                    )}
                    {l.note && <span className="block text-sm text-muted-foreground">{l.note}</span>}
                  </span>
                  {/* THE RATE STAYS EVEN WHEN THE LEVEL IS FULL. Dropping it
                      reads as evasion, and hiding the whole row hides that this
                      is taught at all — which is what somebody was checking. */}
                  {full && <span className="shrink-0 text-sm font-medium">Full — waiting list</span>}
                  <span className={cn("shrink-0 text-base tabular-nums", full ? "text-muted-foreground" : "font-semibold")}>
                    {money(l.rate)} <span className="text-sm font-normal text-muted-foreground">{per}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
