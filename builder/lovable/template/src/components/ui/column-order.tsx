import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Move a column left or right without dragging it.
 *
 * THE KEYBOARD ROUTE FOR COLUMN REORDERING, which almost no table offers —
 * dragging a header is the only way in most grids, and it is unavailable to
 * anybody not using a mouse.
 *
 * DISABLED AT THE ENDS rather than hidden, so the controls do not shift sideways
 * as they are used — the same reasoning as `reorder-buttons`, and it matters
 * more here because the target is a small header cell.
 *
 * Each button names the column AND its position, since after a move the only way
 * to know it worked is to be told where the column landed.
 */
export function ColumnOrder({ column, position, total, onMove, className }: {
  column: string;
  /** 1-based. */
  position: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  className?: string;
}) {
  return (
    <span data-slot="column-order" className={cn("inline-flex", className)}>
      <button type="button" disabled={position <= 1} onClick={() => onMove(-1)}
        aria-label={`Move ${column} left, currently ${position} of ${total}`}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
        <ChevronLeft aria-hidden className="size-3.5" />
      </button>
      <button type="button" disabled={position >= total} onClick={() => onMove(1)}
        aria-label={`Move ${column} right, currently ${position} of ${total}`}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
        <ChevronRight aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}
