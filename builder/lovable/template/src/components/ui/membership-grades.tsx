import { cn } from "@/lib/utils";
/**
 * The membership ladder, by what each grade REQUIRES rather than what it gives.
 *
 * EVERY INSTITUTE LEADS WITH THE BENEFITS AND BURIES THE ENTRY CRITERIA, so
 * somebody with eleven years in the trade and no degree cannot find out in
 * under four pages whether there is a grade for them — and usually concludes
 * there is not. There almost always is. `membership-tier-row` answers "what do
 * I get and what does it cost", which is the question a club's visitor has;
 * this answers "can I even apply", which is the question a professional's does.
 *
 * REQUIREMENTS ARE A LIST, NOT A PARAGRAPH. "Normally five years' relevant
 * experience together with an appropriate qualification, or equivalent
 * demonstrable competence" is one sentence containing four separate tests, and
 * a reader cannot tick themselves against prose. Listed, they can — and the one
 * they fail is visible instead of vague.
 *
 * "OR" ROUTES ARE MARKED AS SUCH, because the experienced-practitioner route is
 * the one that matters most and reads as a footnote everywhere it appears. A
 * grade reachable two ways should say so at the same weight as the first way.
 *
 * THE ASSESSMENT IS NAMED AND SO IS ITS LENGTH. "Peer review" and "a written
 * submission and a 45-minute interview" are the same words to an institute and
 * completely different commitments to an applicant.
 *
 * A POSTNOMINAL IS SHOWN WHERE THERE IS ONE, because for a great many people it
 * is the actual reason to apply, and pretending otherwise helps nobody.
 */
export type Grade = {
  name: string;
  /** "MCIOB", "AMIMechE". The reason a lot of people apply, so it is not hidden. */
  postnominal?: string | null;
  /** Annual subscription. */
  fee?: number | null;
  /** One-off assessment or application fee, shown apart from the subscription. */
  assessmentFee?: number | null;
  /** Each a single test the reader can tick themselves against. */
  requires: string[];
  /**
   * The alternative route. Marked as an alternative, at the same weight.
   *
   * Nullable as well as optional, because every other optional field on this
   * type is — and a caller writing `orRequires: null` to mean "this grade has
   * no second route" is saying something true, not making a type error.
   */
  orRequires?: string[] | null;
  /** "A written submission and a 45-minute professional review." Named, with its length. */
  assessment?: string | null;
  /** "About 12 weeks from submission." */
  takes?: string | null;
};
export function MembershipGrades({
  grades, currency = "GBP", locale = "en-GB", heading = "The grades", note, className,
}: {
  grades: Grade[];
  currency?: string;
  locale?: string;
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!grades.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  return (
    <div data-slot="membership-grades" className={cn("", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      <ol className="mt-3 divide-y divide-border border-y border-border">
        {grades.map((g) => (
          <li key={g.name} className="py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-base font-medium">
                {g.name}
                {g.postnominal && (
                  <span className="ms-2 text-sm font-normal text-muted-foreground">{g.postnominal}</span>
                )}
              </span>
              {typeof g.fee === "number" && (
                <span className="text-base font-semibold tabular-nums">
                  {money(g.fee)}<span className="text-sm font-normal text-muted-foreground"> a year</span>
                </span>
              )}
            </div>

            {/* THE TESTS, SEPARATELY. Nobody can tick themselves against prose,
                and the whole point is finding the one you fail. */}
            <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">You need</p>
                <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
                  {g.requires.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
              {g.orRequires && g.orRequires.length > 0 && (
                <div>
                  {/* THE EXPERIENCED-PRACTITIONER ROUTE, at the same weight as
                      the first one. It is a footnote everywhere else and it is
                      the route most people actually qualify by. */}
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Or, instead of all that</p>
                  <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
                    {g.orRequires.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {(g.assessment || g.takes || typeof g.assessmentFee === "number") && (
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {g.assessment && (
                  <div className="flex min-w-0 gap-1.5">
                    <dt className="shrink-0 text-muted-foreground">Assessed by</dt>
                    <dd className="min-w-0 font-medium">{g.assessment}</dd>
                  </div>
                )}
                {g.takes && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Takes</dt>
                    <dd className="font-medium">{g.takes}</dd>
                  </div>
                )}
                {typeof g.assessmentFee === "number" && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">One-off</dt>
                    <dd className="font-medium tabular-nums">{money(g.assessmentFee)}</dd>
                  </div>
                )}
              </dl>
            )}
          </li>
        ))}
      </ol>
      {note && <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
