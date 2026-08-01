import { cn } from "@/lib/utils";
/**
 * "38 of 480" — how much the filters are hiding.
 *
 * THE UNFILTERED TOTAL IS THE POINT. A bare "38 results" cannot distinguish a
 * narrow search from a collection with 38 things in it, and that distinction is
 * what tells somebody whether to widen. This is the smallest possible fix for
 * the most common confusion about a filtered list.
 *
 * ZERO GETS ITS OWN SENTENCE. "0 of 480" is technically the same information
 * and reads as a broken list; "Nothing matches — 480 in total" says the filters
 * are the cause, which is the actionable half.
 *
 * IT DROPS THE COMPARISON WHEN NOTHING IS FILTERED, because "480 of 480" is
 * noise that makes the row ignorable — and it is the row that must be read on
 * the day it says 38.
 *
 * `role="status"` with `aria-live="polite"`, so a filter change announces the
 * new count. Without it, somebody who cannot see the list has no signal that
 * anything happened.
 */
export function FilterCount({ shown, total, noun = "results", className }: {
  shown: number;
  /** The count with no filters applied. */
  total?: number;
  noun?: string;
  className?: string;
}) {
  const filtered = total !== undefined && total !== shown;
  return (
    <p role="status" aria-live="polite" className={cn("text-sm", className)}>
      {shown === 0 ? (
        <>
          <span className="font-medium">Nothing matches</span>
          {total !== undefined && <span className="text-muted-foreground"> · {total.toLocaleString()} {noun} in total</span>}
        </>
      ) : (
        <>
          <span className="font-medium tabular-nums">{shown.toLocaleString()}</span>
          {filtered && <span className="text-muted-foreground"> of {total!.toLocaleString()}</span>}
          <span className="text-muted-foreground"> {noun}</span>
        </>
      )}
    </p>
  );
}
