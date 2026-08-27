import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * Every time a consent changed, and which version of the policy it was.
 *
 * THE POLICY VERSION IS WHAT MAKES THIS A RECORD RATHER THAN A LOG. "Agreed to
 * marketing" is unanswerable six months later if the wording changed in
 * between — the reader agreed to something, and only the version says what.
 * This is the field every consent log omits and the only one that settles a
 * dispute.
 *
 * WITHDRAWALS ARE AS PROMINENT AS GRANTS, both as entries, in the same shape. A
 * history that only records agreement is evidence for one side of an argument.
 *
 * NEWEST FIRST, unlike `approval-history` — this is checked ("what am I signed
 * up to, and when did that change?") rather than read as a story, and the last
 * change is the one that governs today.
 *
 * IT SAYS HOW THE CHANGE WAS MADE where the caller knows: a consent set through
 * a banner, an account page, or by a member of staff on the phone are different
 * things, and only the source distinguishes them.
 */
export type ConsentChange = {
  id: string;
  label: string;
  granted: boolean;
  at?: string;
  policyVersion?: string;
  source?: string;
};

export function ConsentHistory({ changes, emptyNote = "Nothing has changed yet", className }: {
  /** Newest first. */
  changes: ConsentChange[];
  emptyNote?: string;
  className?: string;
}) {
  if (!changes.length) return <p data-slot="consent-history" className={cn("text-sm text-muted-foreground", className)}>{emptyNote}</p>;
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {changes.map((c) => {
        const d = c.at ? toDate(c.at) : null;
        const ok = d && !Number.isNaN(d.getTime());
        return (
          <li key={c.id} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block">
                <span className="font-medium">{c.granted ? "Agreed to" : "Withdrew"}</span> {c.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.policyVersion && <span>Policy {c.policyVersion}</span>}
                {c.policyVersion && c.source ? " · " : ""}
                {c.source}
              </span>
            </span>
            {ok && (
              <time dateTime={isoAttr(d)} className="shrink-0 text-xs text-muted-foreground">
                {d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </time>
            )}
          </li>
        );
      })}
    </ul>
  );
}
