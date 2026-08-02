import { cn } from "@/lib/utils";
/**
 * What must be in place BEFORE arrival, with the deadline on each.
 *
 * A KENNEL COUGH JAB NEEDED FOURTEEN DAYS AHEAD IS USELESS DISCOVERED THE NIGHT
 * BEFORE. That is the whole component: these requirements are not terms and
 * conditions, they are a countdown, and putting them on a policy page linked
 * from the footer is how a family arrives at seven in the morning with a
 * booked holiday and a dog that cannot be admitted.
 *
 * THE DEADLINE IS THE FIELD, not the requirement. Everybody knows a boarding
 * kennel wants vaccinations; almost nobody knows the booster has to be more
 * than a fortnight old and less than a year. `by` is required for that reason —
 * a requirement with no deadline is one somebody will leave until the week
 * before.
 *
 * LAW AND HOUSE RULES ARE MARKED DIFFERENTLY, because they are argued about
 * differently. "The council licence requires it" ends a conversation; "we ask
 * for it" invites one, and a business that blurs the two will eventually be
 * caught pretending its preference is a regulation.
 *
 * NOTHING IS TICKED. This is not a progress tracker and there is no state to
 * be in — every row applies to everybody, every time. A checklist with empty
 * boxes implies somewhere they get filled in, which is a promise the page
 * cannot keep.
 */
export type Requirement = {
  what: string;
  /** WHEN it has to be done by. Required — the deadline IS the information. */
  by: string;
  /** True where a licence or the law requires it, rather than the business. */
  legal?: boolean;
  detail?: string | null;
};
export function EntryRequirements({
  requirements, heading = "Before they can come", intro, className,
}: {
  requirements: Requirement[];
  heading?: string;
  intro?: string;
  className?: string;
}) {
  if (!requirements.length) return null;
  return (
    <div className={cn("", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      {intro && <p className="mt-2 max-w-prose text-base leading-relaxed text-muted-foreground">{intro}</p>}
      <ol className={cn("divide-y divide-border border-y border-border", intro ? "mt-4" : "mt-3")}>
        {requirements.map((r) => (
          <li key={r.what} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-base font-medium">{r.what}</p>
              {r.detail && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>}
            </div>
            <div className="sm:text-right">
              {/* THE DEADLINE AT WEIGHT. It is the field, not the requirement —
                  everybody knows a kennel wants vaccinations and almost nobody
                  knows the booster has a fortnight's lead time. */}
              <p className="text-base font-medium">{r.by}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {r.legal ? "Required by law or licence" : "Our house rule"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
