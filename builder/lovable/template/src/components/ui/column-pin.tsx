import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Keep a column in view while the rest scrolls sideways.
 *
 * ONE PINNED COLUMN IS WHAT MAKES A WIDE TABLE READABLE — without the name
 * column held still, a horizontally scrolled row is a line of numbers belonging
 * to nobody.
 *
 * IT RETURNS THE STICKY CLASSES rather than wrapping the cell, because the
 * `<td>` is the caller's and a sticky column needs `left` and a background on
 * every cell in it, not on a wrapper. A transparent sticky cell shows the
 * scrolling content sliding underneath, which is the bug this shape always has.
 *
 * The toggle names the column, or a header row of identical pin buttons is
 * unusable with a screen reader.
 */
export const PIN_CELL = "sticky start-0 z-10 bg-background";

export function ColumnPin({ column, pinned, onToggle, className }: {
  column: string;
  pinned: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const Icon = pinned ? PinOff : Pin;
  return (
    <button data-slot="column-pin" type="button" onClick={onToggle}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${column}` : `Pin ${column} so it stays in view`}
      className={cn("cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      <Icon aria-hidden className="size-3.5" />
    </button>
  );
}
