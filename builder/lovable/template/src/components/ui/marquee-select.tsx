import { cn } from "@/lib/utils";
/**
 * The rectangle you drag across a grid to lasso things.
 *
 * PURELY THE VISUAL. It draws the box from a rectangle the caller supplies and
 * owns no pointer handlers, because which items fall inside depends entirely on
 * the caller's layout — and a component that guessed would be wrong on every
 * grid it did not design.
 *
 * `pointer-events-none` is load-bearing: the box is painted over the very items
 * being dragged across, and without it the rectangle swallows the pointer
 * events that are drawing it, so the drag stops the instant it starts.
 *
 * `aria-hidden`, and the caller is expected to announce the count elsewhere —
 * `selection-tray` or `selection-limit` already do. A live region on a shape
 * that changes every animation frame would talk continuously and say nothing.
 *
 * NEGATIVE DRAGS ARE NORMALISED. Dragging up-and-left gives a rectangle with a
 * smaller end than start, and rendering that raw produces an invisible box —
 * the single commonest bug in this pattern.
 */
export type Rect = { x1: number; y1: number; x2: number; y2: number };

export function MarqueeSelect({ rect, active, className }: {
  /** Drag start and current point, in pixels relative to the positioned parent. */
  rect?: Rect | null;
  active?: boolean;
  className?: string;
}) {
  if (!active || !rect) return null;
  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);
  if (width < 2 && height < 2) return null;

  return (
    <div aria-hidden
      style={{ left, top, width, height }}
      className={cn("pointer-events-none absolute z-10 rounded-xs border border-foreground bg-foreground/10", className)} />
  );
}
