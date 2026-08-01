import { cn } from "@/lib/utils";
/**
 * What the search understood you to mean.
 *
 * THE GAP BETWEEN TYPED AND INTERPRETED IS INVISIBLE, and it is where confused
 * results come from — a stemmer matched "running" to "run", a synonym expanded
 * "boat" to "vessel", a typo was silently corrected. Saying so turns a strange
 * result into an explicable one.
 *
 * THE CORRECTION IS REVERSIBLE. "Showing results for X — search for Y instead"
 * is the pattern that works, because a silent correction on a term somebody
 * typed deliberately is maddening and unrecoverable.
 *
 * Expansions are listed plainly rather than hidden behind an info icon: they are
 * the explanation, and an icon nobody presses explains nothing.
 */
export function QueryExplain({ typed, interpreted, expansions, onUseExact, className }: {
  typed: string;
  /** What was actually searched for, if different. */
  interpreted?: string;
  /** Extra terms folded in — ["vessel", "craft"]. */
  expansions?: string[];
  /** Search the typed term verbatim instead. */
  onUseExact?: () => void;
  className?: string;
}) {
  const corrected = interpreted && interpreted !== typed;
  if (!corrected && !expansions?.length) return null;
  return (
    <p role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground", className)}>
      {corrected && (
        <span>
          Showing results for <span className="font-medium text-foreground">{interpreted}</span>
        </span>
      )}
      {expansions?.length ? <span>Also matching {expansions.join(", ")}.</span> : null}
      {corrected && onUseExact && (
        <button type="button" onClick={onUseExact} className="cursor-pointer underline underline-offset-4">
          Search for “{typed}” instead
        </button>
      )}
    </p>
  );
}
