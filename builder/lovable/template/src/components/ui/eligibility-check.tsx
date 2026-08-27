import { cn } from "@/lib/utils";
/**
 * Whether somebody qualifies — with the reason, and what to do if not.
 *
 * A NO IS ALWAYS ACCOMPANIED BY A ROUTE. "You are not eligible" with nothing
 * after it is where people stop, and a large share of them were eligible for
 * something else, or would be after one change. The alternative is the useful
 * half of the answer.
 *
 * EVERY CRITERION IS SHOWN, MET OR NOT — not just the failing one. Somebody who
 * fails on two things needs to know both before they change anything, and a
 * check that reveals them one at a time wastes weeks.
 *
 * "PROBABLY" IS A PERMITTED ANSWER. Most eligibility depends on facts the form
 * does not have, and a definite refusal that turns out to be wrong stops people
 * applying for things they are entitled to. Indicative is stated as indicative.
 *
 * MET AND UNMET ARE CARRIED BY THE WORD, not a tick and a cross in two colours
 * — this is read on a phone, printed, and by people using a screen reader.
 */
export type Criterion = { id: string; label: string; met?: boolean; detail?: string };

export function EligibilityCheck({ criteria, indicative = true, alternative, applyNote, className }: {
  criteria: Criterion[];
  /** False only where the answer is genuinely a decision. */
  indicative?: boolean;
  /** What to try instead when the answer is no. */
  alternative?: string;
  /** What happens next when the answer is yes. */
  applyNote?: string;
  className?: string;
}) {
  const unmet = criteria.filter((c) => c.met === false);
  const unknown = criteria.filter((c) => c.met === undefined);
  const eligible = unmet.length === 0 && unknown.length === 0;
  return (
    <div data-slot="eligibility-check" className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium">
        {eligible
          ? indicative ? "You look eligible" : "You are eligible"
          : unmet.length > 0
            ? `Not eligible on ${unmet.length} of ${criteria.length} ${criteria.length === 1 ? "condition" : "conditions"}`
            : "We cannot tell yet"}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {criteria.map((c) => (
          <li key={c.id} className="flex items-start gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className={cn("block", c.met === false && "font-medium")}>{c.label}</span>
              {c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}
            </span>
            <span className={cn("shrink-0 text-xs", c.met === false ? "font-medium" : "text-muted-foreground")}>
              {c.met === true ? "Met" : c.met === false ? "Not met" : "Not known"}
            </span>
          </li>
        ))}
      </ul>
      {eligible && applyNote && <p className="text-xs">{applyNote}</p>}
      {!eligible && alternative && <p className="text-xs">{alternative}</p>}
      {indicative && (
        <p className="text-xs text-muted-foreground">
          This is a guide, not a decision. Apply if you think it is wrong — it costs nothing to be told properly.
        </p>
      )}
    </div>
  );
}
