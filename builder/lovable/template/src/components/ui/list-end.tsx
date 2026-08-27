import { cn } from "@/lib/utils";
/**
 * The line that says a list has genuinely finished.
 *
 * WITHOUT IT, THE BOTTOM OF A LIST AND A FAILED LOAD LOOK IDENTICAL. Somebody
 * scrolls to the end of an infinite list, nothing more appears, and there is no
 * way to tell "that is everything" from "the next request died". They wait,
 * then refresh, then lose their place. One sentence settles it.
 *
 * IT STATES THE TOTAL where the caller has one, because "that is all 47" also
 * quietly confirms the list loaded everything it promised — a count that
 * disagrees with the filter above is how a truncation gets noticed.
 *
 * IT RENDERS NOTHING FOR AN EMPTY LIST. "That is everything" under zero results
 * is a joke at the reader's expense; an empty list needs an empty state, which
 * is a different component with a different job.
 *
 * `role="status"` — for anybody navigating by keyboard or screen reader, the
 * end of a growing list is otherwise completely unmarked.
 */
export function ListEnd({ total, noun = "items", note, className }: {
  /** Number of items in the finished list. Omit for the bare sentence. */
  total?: number;
  noun?: string;
  note?: React.ReactNode;
  className?: string;
}) {
  if (total !== undefined && total <= 0) return null;
  return (
    <p data-slot="list-end" role="status" className={cn("py-4 text-center text-xs text-muted-foreground", className)}>
      {total === undefined
        ? "That is everything"
        : <>That is all <span className="tabular-nums">{total.toLocaleString()}</span> {total === 1 ? noun.replace(/s$/, "") : noun}</>}
      {note && <span className="block">{note}</span>}
    </p>
  );
}
