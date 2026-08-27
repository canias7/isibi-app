import { cn } from "@/lib/utils";
/**
 * "The next questions depend on this."
 *
 * A BRANCHING FORM CHANGES SHAPE UNDER THE READER, and without warning that
 * feels like a bug — questions appear, others vanish, and the progress bar jumps
 * backwards. One sentence before the branching question removes all of it.
 *
 * IT WARNS BEFORE CHANGING AN ANSWER THAT HAS CONSEQUENCES. Going back and
 * flipping a branch usually discards everything answered down the old path, and
 * discovering that afterwards is the most expensive way to find out. `discards`
 * says how much.
 *
 * `role="status"` so the warning is announced when it becomes relevant rather
 * than sitting silently beside a control.
 */
export function BranchingNote({ affects, discards, className }: {
  /** What depends on it — "the next three questions". */
  affects?: string;
  /** How many answers would be lost by changing it now. */
  discards?: number;
  className?: string;
}) {
  if (!affects && !discards) return null;
  return (
    <p data-slot="branching-note" role="status" className={cn("text-xs text-muted-foreground", className)}>
      {affects && <>This decides {affects}. </>}
      {typeof discards === "number" && discards > 0 && (
        <span className="font-medium text-foreground">
          Changing it now clears {discards} {discards === 1 ? "answer" : "answers"}.
        </span>
      )}
    </p>
  );
}
