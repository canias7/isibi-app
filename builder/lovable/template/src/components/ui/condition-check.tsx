import { cn } from "@/lib/utils";
/**
 * The state of something at handover — recorded by both sides.
 *
 * DAMAGE NOT RECORDED AT COLLECTION BECOMES THE HIRER'S ON RETURN. That is the
 * whole economics of this form, and it is why the component treats an unsigned
 * or unrecorded check as a defect rather than as an optional step. An empty check
 * is not "no damage"; it is "nobody looked".
 *
 * BOTH PARTIES SIGN THE SAME LIST. A check completed by the depot alone is one
 * side's account, and every dispute about a scratch turns on whether the other
 * side saw the list at the time.
 *
 * EXISTING DAMAGE IS LISTED SEPARATELY FROM NEW DAMAGE. On return the only
 * question is what changed, and a single merged list makes that impossible to
 * answer without reading two documents side by side.
 *
 * NO PHOTOGRAPH REQUIREMENT BUILT IN. Photographs help and are frequently
 * impossible in a yard in the rain; the written list is what actually gets
 * completed, and a form nobody fills in protects nobody.
 */
export type Mark = { id: string; where: string; what: string; preExisting?: boolean };

export function ConditionCheck({ stage, marks, checkedBy, hirerSigned, className }: {
  stage: "collection" | "return";
  marks: Mark[];
  checkedBy?: string;
  /** Unsigned is a defect, not an option. */
  hirerSigned?: boolean;
  className?: string;
}) {
  const existing = marks.filter((m) => m.preExisting);
  const fresh = marks.filter((m) => !m.preExisting);
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        {stage === "collection" ? "Checked at collection" : "Checked on return"}
      </p>
      {marks.length === 0 ? (
        <p className="font-medium">
          Nothing recorded. That is not the same as no damage — it means nobody looked, and on return every mark
          becomes the hirer's.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {marks.map((m) => (
            <li key={m.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                {m.where}
                <span className="block text-xs text-muted-foreground">{m.what}</span>
              </span>
              <span className={cn("shrink-0 text-xs", m.preExisting ? "text-muted-foreground" : "font-medium")}>
                {m.preExisting ? "Already there" : "New"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {stage === "return" && (
        <p className={cn("text-xs", fresh.length > 0 ? "font-medium" : "text-muted-foreground")}>
          {fresh.length === 0
            ? `Nothing new. ${existing.length} ${existing.length === 1 ? "mark was" : "marks were"} there at collection.`
            : `${fresh.length} new ${fresh.length === 1 ? "mark" : "marks"} since collection. Everything else was recorded before it went out.`}
        </p>
      )}
      <p className={cn("text-xs", hirerSigned ? "text-muted-foreground" : "font-medium")}>
        {hirerSigned
          ? `Signed by both${checkedBy ? `, checked by ${checkedBy}` : ""}.`
          : "The hirer has not signed this. One side's account of the condition is not a record."}
      </p>
    </div>
  );
}
