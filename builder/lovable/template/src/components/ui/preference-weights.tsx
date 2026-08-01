import { cn } from "@/lib/utils";
/**
 * Saying what matters most — by ordering, not by sliders.
 *
 * PEOPLE CANNOT SET NUMERIC WEIGHTS AND THE RESULTS ARE WORSE WHEN THEY TRY.
 * Sliders produce everything at maximum, which carries no information at all,
 * and the fix is not a nag — it is asking a question people can answer. Rank
 * order is that question.
 *
 * A MUST-HAVE IS A SEPARATE THING FROM A PREFERENCE. Ranking cannot express
 * "without this, nothing else matters", and squashing a hard requirement into
 * the top of a preference list is how people get shown things they explicitly
 * ruled out.
 *
 * THE EFFECT OF EACH MUST-HAVE IS SHOWN. Every requirement narrows the pool,
 * and somebody with four of them and no matches deserves to see which one is
 * costing the most rather than concluding nobody exists.
 *
 * IT WORKS WITH A KEYBOARD. Reordering that needs a drag is unusable to a
 * large number of people, so movement is by buttons with real labels.
 */
export type Preference = { id: string; label: string; mustHave?: boolean; excludesPercent?: number };

export function PreferenceWeights({ preferences, onMoveUp, onMoveDown, onToggleMustHave, className }: {
  /** In the user's order, most important first. */
  preferences: Preference[];
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onToggleMustHave?: (id: string) => void;
  className?: string;
}) {
  const musts = preferences.filter((p) => p.mustHave);
  const costliest = musts.reduce<Preference | null>(
    (a, p) => (p.excludesPercent === undefined ? a : !a || (a.excludesPercent ?? 0) < p.excludesPercent ? p : a),
    null,
  );
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">
        Most important at the top. We ask you to order them rather than set sliders, because everybody sets every slider to maximum.
      </p>
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {preferences.map((p, i) => (
          <li key={p.id} className="flex items-baseline gap-2 px-3 py-1.5">
            <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">
              {p.label}
              {p.mustHave && <span className="text-xs font-medium"> · must have</span>}
              {p.mustHave && p.excludesPercent !== undefined && (
                <span className="block text-xs tabular-nums text-muted-foreground">
                  Rules out {p.excludesPercent}% of everybody.
                </span>
              )}
            </span>
            {onToggleMustHave && (
              <button type="button" onClick={() => onToggleMustHave(p.id)} className="shrink-0 text-xs underline underline-offset-2">
                {p.mustHave ? "Make it a preference" : "Make it a must"}
                <span className="sr-only"> — {p.label}</span>
              </button>
            )}
            {onMoveUp && (
              <button type="button" disabled={i === 0} onClick={() => onMoveUp(p.id)} className="shrink-0 text-xs underline underline-offset-2 disabled:no-underline disabled:opacity-40">
                Up<span className="sr-only"> — move {p.label} up</span>
              </button>
            )}
            {onMoveDown && (
              <button type="button" disabled={i === preferences.length - 1} onClick={() => onMoveDown(p.id)} className="shrink-0 text-xs underline underline-offset-2 disabled:no-underline disabled:opacity-40">
                Down<span className="sr-only"> — move {p.label} down</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {costliest && costliest.excludesPercent !== undefined && (
        <p className="text-xs">
          {costliest.label} is the one narrowing things most — it alone rules out {costliest.excludesPercent}%.
        </p>
      )}
    </div>
  );
}
