import { cn, toDate } from "@/lib/utils";
/**
 * What has to be in place, with evidence and who signed it off.
 *
 * EVIDENCE IS PART OF AN ITEM, NOT A TICK. A checklist of ticks is a claim
 * somebody made once; a link to the document that proves it is what survives an
 * inspection. An item ticked with nothing attached is marked as such.
 *
 * NOT-APPLICABLE IS A REAL ANSWER and needs its reason. Half of any compliance
 * list does not apply, and leaving those unticked makes a complete list look
 * two-thirds finished forever — while ticking them is a false claim.
 *
 * WHO AND WHEN, on every item. Compliance is about accountability, and an item
 * confirmed by nobody at no particular time answers none of the questions
 * anybody asks of this list.
 *
 * THE OUTSTANDING COUNT EXCLUDES NOT-APPLICABLE, or the headline is wrong in
 * the reassuring direction — which is the one direction it must not be wrong
 * in.
 */
export type ComplianceItem = {
  id: string;
  label: string;
  state: "done" | "todo" | "not-applicable";
  /** Why it does not apply. */
  reason?: string;
  /** Name of the attached proof. */
  evidence?: string;
  by?: string;
  /** ISO date. */
  at?: string;
};

export function ComplianceChecklist({ items, className }: { items: ComplianceItem[]; className?: string }) {
  const todo = items.filter((i) => i.state === "todo");
  const na = items.filter((i) => i.state === "not-applicable");
  const relevant = items.length - na.length;
  const WORD = { done: "Done", todo: "Outstanding", "not-applicable": "Does not apply" } as const;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {todo.length === 0
          ? <span className="text-muted-foreground">All {relevant} that apply are done</span>
          : <><span className="font-medium tabular-nums">{todo.length}</span> of {relevant} outstanding</>}
        {na.length > 0 && <span className="text-muted-foreground"> · {na.length} do not apply</span>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {items.map((i) => {
          const d = i.at ? toDate(i.at) : null;
          const ok = d && !Number.isNaN(d.getTime());
          return (
            <li key={i.id} className="flex items-start gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className={cn("block", i.state === "todo" && "font-medium",
                  i.state === "not-applicable" && "text-muted-foreground")}>
                  {i.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {i.state === "not-applicable" && (i.reason ?? "No reason recorded")}
                  {i.state === "done" && (i.evidence
                    ? `Evidence: ${i.evidence}`
                    : "No evidence attached")}
                  {i.state === "done" && i.by && ` · ${i.by}`}
                  {i.state === "done" && ok && ` · ${d!.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs", i.state === "todo" ? "font-medium" : "text-muted-foreground")}>
                {WORD[i.state]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
