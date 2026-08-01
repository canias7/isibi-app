import { cn } from "@/lib/utils";
/**
 * Every plural form a language needs, with the numbers that trigger each.
 *
 * ENGLISH HAS TWO FORMS AND THAT IS THE EXCEPTION, NOT THE RULE. Arabic has
 * six, Polish and Russian have four, Japanese has one — so a translation form
 * offering "singular" and "plural" is unfillable in most languages, and the
 * result is a translator putting something plausible in the wrong box.
 *
 * IT SHOWS WHICH NUMBERS EACH FORM COVERS, derived from `Intl.PluralRules`
 * rather than a table someone maintained. A Polish translator seeing `few: 2,
 * 3, 4, 22` immediately knows which sentence belongs there; "few" alone means
 * nothing.
 *
 * THE ZERO CASE IS SHOWN SEPARATELY where a language has one, because "no
 * items" is often a completely different sentence and is the form most likely
 * to be forgotten.
 *
 * NO DEPENDENCY. `Intl.PluralRules` is in every runtime this template targets,
 * and a hand-rolled table would be wrong for some language within a year.
 */
export function PluralisationPreview({ locale, forms = {}, sample = [0, 1, 2, 3, 5, 11, 21, 22, 100], className }: {
  /** BCP-47 tag. */
  locale: string;
  /** What the translator has written per category. */
  forms?: Partial<Record<Intl.LDMLPluralRule, string>>;
  /** Numbers used to work out which categories the language uses. */
  sample?: number[];
  className?: string;
}) {
  let rules: Intl.PluralRules;
  try { rules = new Intl.PluralRules(locale); } catch { return null; }
  const seen = new Map<string, number[]>();
  for (const n of sample) {
    const cat = rules.select(n);
    seen.set(cat, [...(seen.get(cat) ?? []), n]);
  }
  const cats = [...seen.keys()];
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">
        This language needs <span className="font-medium text-foreground tabular-nums">{cats.length}</span>{" "}
        {cats.length === 1 ? "form" : "forms"}.
      </p>
      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        {cats.map((c) => {
          const written = forms[c as Intl.LDMLPluralRule];
          return (
            <div key={c} className="px-3 py-2">
              <dt className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                <span className="font-mono">{c}</span>
                <span className="tabular-nums">{seen.get(c)!.join(", ")}…</span>
              </dt>
              <dd className={cn("text-sm", !written && "italic text-muted-foreground")} lang={written ? locale : undefined}>
                {written || "not written yet"}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
