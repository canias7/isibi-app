import { cn } from "@/lib/utils";
/**
 * Why this one will not move.
 *
 * A list where most rows drag and some do not is the worst version of a
 * reorderable list: the reader tries, nothing happens, and they cannot tell a
 * rule from a bug. They usually try three more times before giving up.
 *
 * THE REASON IS REQUIRED. "Locked" is not an explanation — "Pinned to the top"
 * and "Sorted by date, turn off sorting to reorder" are, and the second one
 * also says how to fix it.
 *
 * Rendered as a plain note beside the row rather than a tooltip, because a
 * tooltip needs a hover the reader has no reason to attempt: they have already
 * concluded the row is broken.
 *
 * The `sr-only` prefix ties it to the item, so a screen reader gets "Full
 * restoration cannot be moved: pinned to the top" rather than a loose sentence
 * after a list item.
 */
export function DragDisabledNote({ what, reason, className }: {
  /** The row it belongs to. */
  what?: string;
  /** Why it will not move. Required — "locked" explains nothing. */
  reason: string;
  className?: string;
}) {
  return (
    <span data-slot="drag-disabled-note" className={cn("text-xs text-muted-foreground", className)}>
      {what && <span className="sr-only">{what} cannot be moved: </span>}
      {reason}
    </span>
  );
}
