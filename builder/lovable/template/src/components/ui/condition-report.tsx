import { cn } from "@/lib/utils";
/**
 * The condition of a lot — with the disclaimer that is legally the point.
 *
 * ABSENCE OF A MENTION IS NOT ABSENCE OF A FAULT, and every catalogue says so
 * in small print nobody reads. Putting it beside the report is the honest
 * placement, because bidders genuinely believe an unmentioned crack means there
 * is no crack.
 *
 * RESTORATION IS RECORDED AS A FACT, not as damage. Almost everything old has
 * been restored, hiding it depresses trust rather than raising prices, and a
 * buyer who discovers it afterwards asks for the money back.
 *
 * WHO EXAMINED IT AND WHEN is part of the report. A report written from
 * photographs is not the same document as one written with the object in hand,
 * and only one of them is worth relying on.
 *
 * VIEWING IS OFFERED AS THE REAL ANSWER. No report replaces looking, and a
 * house that says so is more trustworthy than one implying its report is
 * sufficient.
 */
export type ConditionPoint = { id: string; where: string; what: string; restoration?: boolean };

export function ConditionReport({ points, examinedBy, examinedOn, inHand, viewingNote, className }: {
  points: ConditionPoint[];
  examinedBy?: string;
  examinedOn?: string;
  /** False where the report was written from photographs. */
  inHand?: boolean;
  viewingNote?: string;
  className?: string;
}) {
  const restorations = points.filter((p) => p.restoration);
  return (
    <div className={cn("space-y-1.5", className)}>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is noted, which is not the same as nothing being wrong.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {points.map((p) => (
            <li key={p.id} className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{p.where}</span>
              <span className="min-w-0 flex-1">
                {p.what}
                {p.restoration && <span className="block text-xs text-muted-foreground">Restoration, not damage</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {restorations.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {restorations.length} {restorations.length === 1 ? "point is" : "points are"} restoration. Almost everything of this age has some.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {examinedBy ? `Examined by ${examinedBy}` : "Nobody is named as having examined it"}
        {examinedOn && ` on ${examinedOn}`}
        {inHand === false && " — from photographs, not with the object in hand"}
      </p>
      <p className="text-xs font-medium">
        Anything not mentioned here has not been ruled out. This report is not a guarantee of condition.
      </p>
      {viewingNote && <p className="text-xs">{viewingNote}</p>}
    </div>
  );
}
