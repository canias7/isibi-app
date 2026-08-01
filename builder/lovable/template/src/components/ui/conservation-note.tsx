import { cn } from "@/lib/utils";
/**
 * The condition of an object — and what has been done to it.
 *
 * TREATMENT IS RECORDED AS WHAT WAS DONE, WITH WHAT, AND BY WHOM. A note saying
 * "cleaned, 1978" is worthless to the conservator who has to decide in 2040
 * whether the surface is original — and the materials used determine whether the
 * treatment can be reversed at all.
 *
 * REVERSIBILITY IS ITS OWN FIELD. It is the central principle of the discipline
 * and the single most consequential fact about any past intervention, and it is
 * routinely lost because nobody wrote it down.
 *
 * "STABLE" IS NOT "GOOD". An object can be stable and badly damaged; the two get
 * conflated in a single condition word, and a loan request is then approved on
 * the strength of it.
 *
 * ENVIRONMENTAL REQUIREMENTS TRAVEL WITH THE OBJECT, because they decide whether
 * it can be displayed, lent or moved at all — and they are the first thing a
 * borrowing venue must be told.
 */
export type Treatment = {
  id: string;
  /** Free text — "1978". */
  when: string;
  what: string;
  materials?: string;
  by?: string;
  reversible?: boolean;
};

export function ConservationNote({ condition, stable, damage, treatments = [], environment, displayLimit, className }: {
  /** Plain words — "fair". */
  condition?: string;
  /** Whether deterioration has stopped, which is a separate question. */
  stable?: boolean;
  /** What is actually wrong with it. */
  damage?: string;
  treatments?: Treatment[];
  /** "18–22°C, 45–55% RH, under 50 lux". */
  environment?: string;
  /** "3 months in any 5 years". */
  displayLimit?: string;
  className?: string;
}) {
  const irreversible = treatments.filter((t) => t.reversible === false);
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        {condition ?? "Condition not assessed"}
        {stable !== undefined && (
          <span className="text-muted-foreground">
            {stable ? " · stable" : " · not stable, still deteriorating"}
          </span>
        )}
      </p>
      {damage && <p className="text-xs">{damage}</p>}
      {stable && condition && (
        <p className="text-xs text-muted-foreground">
          Stable means the damage is not getting worse — not that the object is undamaged.
        </p>
      )}
      {treatments.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-xs">
          {treatments.map((t) => (
            <li key={t.id} className="space-y-0.5 px-3 py-1.5">
              <p>
                <span className="tabular-nums text-muted-foreground">{t.when}</span> — {t.what}
              </p>
              <p className="text-muted-foreground">
                {t.materials ?? "Materials not recorded"}
                {t.by && ` · ${t.by}`}
              </p>
              <p className={cn(t.reversible === false && "font-medium")}>
                {t.reversible === true ? "Reversible." : t.reversible === false ? "Not reversible." : "Reversibility not recorded."}
              </p>
            </li>
          ))}
        </ul>
      )}
      {irreversible.length > 0 && (
        <p className="text-xs font-medium">
          {irreversible.length === 1 ? "One past treatment cannot" : `${irreversible.length} past treatments cannot`} be undone.
        </p>
      )}
      {environment && <p className="text-xs text-muted-foreground">Requires {environment}.</p>}
      {displayLimit && <p className="text-xs">May be displayed {displayLimit}.</p>}
    </div>
  );
}
