import { cn } from "@/lib/utils";
/**
 * "Answering yes here adds two more steps" — what a choice does to the flow.
 *
 * THE LENGTH OF A FORM CHANGES WITH THE ANSWERS and nobody is told. Somebody
 * who has budgeted five minutes ticks one box and quietly signs up for fifteen,
 * which is a large part of why long conditional forms get abandoned midway.
 * Saying so at the moment of the choice is the entire component.
 *
 * IT ALSO REPORTS STEPS REMOVED, which is the more welcome half and always
 * omitted. "That skips the next two steps" is a reason to answer honestly
 * rather than a reason to lie to make the form shorter.
 *
 * IT NAMES THE STEPS where the caller has them. "Two more steps" is a cost;
 * "proof of address and a reference" is a cost somebody can decide whether they
 * are able to pay right now.
 *
 * `role="status"`, because it appears in response to a choice just made, and it
 * never blocks — this is information, not a warning.
 */
export function BranchPreview({ added = [], removed = [], className }: {
  /** Names of steps this answer adds. */
  added?: string[];
  /** Names of steps it skips. */
  removed?: string[];
  className?: string;
}) {
  if (!added.length && !removed.length) return null;
  const list = (xs: string[]) =>
    xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  return (
    <p data-slot="branch-preview" role="status" className={cn("text-xs text-muted-foreground", className)}>
      {added.length > 0 && (
        <span>
          This adds <span className="text-foreground">{added.length}</span> more {added.length === 1 ? "step" : "steps"}
          <span> — {list(added)}</span>.
        </span>
      )}
      {added.length > 0 && removed.length > 0 && " "}
      {removed.length > 0 && (
        <span>
          This skips <span className="text-foreground">{removed.length}</span> {removed.length === 1 ? "step" : "steps"}
          <span> — {list(removed)}</span>.
        </span>
      )}
    </p>
  );
}
