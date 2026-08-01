import { cn } from "@/lib/utils";
/**
 * "These two filters cannot both be true" — why the list is empty.
 *
 * AN EMPTY LIST IS AMBIGUOUS AND THIS RESOLVES IT. No results can mean the data
 * is missing, the search was too narrow, or two filters are logically
 * incompatible — and only the third is the interface's fault. Somebody filtering
 * to "cancelled" AND "paid in full" will otherwise conclude their records have
 * vanished.
 *
 * IT OFFERS TO DROP ONE SIDE, NAMED. "Clear filters" throws away the seven
 * settings that were fine along with the one that was wrong; naming the
 * conflicting pair lets somebody keep the rest of a view they spent time on.
 *
 * IT IS A NOTE, NOT AN ALERT, and it does not block. The combination might be
 * deliberate — checking that nothing is both cancelled and paid is a real
 * question — so the component explains rather than refuses.
 *
 * `role="status"`, because it appears in response to a change the person just
 * made and is the explanation for what they are looking at.
 */
export function FilterConflict({ a, b, reason, onDrop, className }: {
  /** The two conflicting filters, each with a label and an id. */
  a: { id: string; label: string };
  b: { id: string; label: string };
  /** Why they cannot both hold. */
  reason?: string;
  onDrop?: (id: string) => void;
  className?: string;
}) {
  return (
    <div role="status"
      className={cn("rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm", className)}>
      <p>
        <span className="font-medium">{a.label}</span> and <span className="font-medium">{b.label}</span> cannot both apply, so nothing will match.
      </p>
      {reason && <p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>}
      {onDrop && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <button type="button" onClick={() => onDrop(a.id)} className="underline underline-offset-2">
            Drop “{a.label}”
          </button>
          <button type="button" onClick={() => onDrop(b.id)} className="underline underline-offset-2">
            Drop “{b.label}”
          </button>
        </p>
      )}
    </div>
  );
}
