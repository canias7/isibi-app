import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Tiles you can rearrange — a gallery, a dashboard, a set of cards.
 *
 * THE POSITION IS WRITTEN ON EVERY TILE. In a list, order is obvious from
 * reading down; in a grid it is not, because "next" could be right or down
 * depending on how the reader assumes it wraps. A visible "3 of 12" removes the
 * guess, and it is the only way to confirm a move landed where you meant.
 *
 * Keyboard moves are PREVIOUS and NEXT rather than up/down/left/right.
 * Direction keys in a grid have to know the column count, which changes with
 * the viewport — so the same key does different things at different widths,
 * which is worse than one unambiguous pair.
 *
 * `aria-live` announces the landing position, for the same reason as
 * `reorder-list`: a tile silently changing place is indistinguishable from
 * nothing happening.
 *
 * `min` sets the tile width and the grid wraps itself with `auto-fill`, so no
 * caller has to pass a column count that would be wrong on a phone.
 */
export function SortableGrid({ items, onMove, min = 160, announce, className }: {
  items: { key: string; name: string; content: React.ReactNode }[];
  onMove: (key: string, direction: -1 | 1) => void;
  /** Minimum tile width in pixels. */
  min?: number;
  announce?: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div data-slot="sortable-grid" className={className}>
      <p role="status" aria-live="polite" className="sr-only">{announce ?? ""}</p>
      <ol className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
        {items.map((it, i) => (
          <li key={it.key} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden className="cursor-grab text-muted-foreground"><GripVertical className="size-4" /></span>
              <span className="text-xs text-muted-foreground tabular-nums">{i + 1} of {items.length}</span>
            </div>
            <div className="min-w-0 text-sm">{it.content}</div>
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => onMove(it.key, -1)}
                aria-label={`Move ${it.name} earlier, currently ${i + 1} of ${items.length}`}
                className="flex-1 cursor-pointer rounded border border-border py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                Earlier
              </button>
              <button type="button" disabled={i === items.length - 1} onClick={() => onMove(it.key, 1)}
                aria-label={`Move ${it.name} later, currently ${i + 1} of ${items.length}`}
                className="flex-1 cursor-pointer rounded border border-border py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                Later
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
