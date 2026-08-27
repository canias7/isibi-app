import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Showing results for X — search instead for Y".
 *
 * IT NEVER SILENTLY REPLACES THE QUERY. Auto-correcting and saying nothing is
 * how somebody searching for a real but unusual name — a customer, a product
 * code — gets somebody else's results and never finds out why. The correction
 * happens, and the original is one press away.
 *
 * The escape hatch is a LINK BACK TO THE EXACT QUERY, phrased as "search
 * instead for". That wording matters: "did you mean" alone offers a suggestion,
 * while this states what has already been done.
 *
 * Two different situations, two different messages: `corrected` means results
 * are being shown for something else, `suggestion` means the original returned
 * nothing and here is a guess. Collapsing them into one component that says
 * "did you mean" for both misreports which happened.
 *
 * `aria-live="polite"`, because the correction is exactly the fact somebody not
 * looking at the top of the page needs.
 */
export function DidYouMean({ original, corrected, suggestion, onUse, onKeepOriginal, className }: {
  original: string;
  corrected?: string;
  suggestion?: string;
  onUse?: (q: string) => void;
  onKeepOriginal?: () => void;
  className?: string;
}) {
  if (!corrected && !suggestion) return null;
  return (
    <p data-slot="did-you-mean" aria-live="polite" className={cn("text-sm", className)}>
      {corrected ? (
        <>
          Showing results for <strong className="font-medium">{corrected}</strong>.{" "}
          <button type="button" onClick={onKeepOriginal}
            className="cursor-pointer underline underline-offset-2 hover:no-underline">
            Search instead for &ldquo;{original}&rdquo;
          </button>
        </>
      ) : (
        <>
          Nothing for <strong className="font-medium">{original}</strong>. Did you mean{" "}
          <button type="button" onClick={() => onUse?.(suggestion!)}
            className="cursor-pointer font-medium underline underline-offset-2 hover:no-underline">
            {suggestion}
          </button>?
        </>
      )}
    </p>
  );
}
