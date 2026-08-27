import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A cell holding more than fits, with the rest one press away.
 *
 * DIFFERENT FROM `cell-tooltip`, which shows a long STRING. This is for a cell
 * holding several values — five tags, three assignees — where the honest display
 * is "two, and 3 more" rather than a truncated list that cuts a name in half.
 *
 * THE OVERFLOW COUNT IS A BUTTON, not text. The values in it are real content
 * somebody may need, and a "+3" that cannot be opened is a table telling you
 * data exists and refusing to show it.
 *
 * Expanded, it lists the remainder in place rather than in a popover — a table
 * row that grows is far less disruptive than a floating layer that covers the
 * rows underneath it.
 */
export function CellOverflow({ items, show = 2, className }: {
  items: React.ReactNode[];
  /** How many before collapsing. */
  show?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  if (!items.length) return null;
  const shown = open ? items : items.slice(0, show);
  const rest = items.length - shown.length;
  return (
    <span data-slot="cell-overflow" className={cn("flex flex-wrap items-center gap-1", className)}>
      <span id={id} className="flex flex-wrap gap-1">
        {shown.map((it, i) => <span key={i}>{it}</span>)}
      </span>
      {rest > 0 && (
        <button type="button" onClick={() => setOpen(true)} aria-controls={id} aria-expanded={false}
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 tabular-nums">
          and {rest} more
        </button>
      )}
      {open && items.length > show && (
        <button type="button" onClick={() => setOpen(false)} aria-controls={id} aria-expanded
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
          show fewer
        </button>
      )}
    </span>
  );
}
