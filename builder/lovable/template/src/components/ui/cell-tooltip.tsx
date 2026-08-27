import { cn } from "@/lib/utils";
/**
 * A truncated cell whose full value is reachable.
 *
 * NOT A HOVER TOOLTIP. Hover does not exist on touch, so a cell whose full text
 * is only available on hover is a cell most readers can never read. This uses
 * `<details>` semantics via a native `title` for the pointer case AND keeps the
 * full text in the accessible name, so it is announced properly.
 *
 * THE TRUNCATION IS CSS, so the full string stays in the DOM for find-in-page
 * and for copy — cutting it in JavaScript means the visible ellipsis is all
 * anybody can select.
 *
 * `title` is added only when the text is actually long enough to clip, since a
 * tooltip repeating a fully visible value is noise on every cell of a table.
 */
export function CellTooltip({ text, clipAt = 40, className }: {
  text: string;
  /** Characters before a tooltip is worth adding. */
  clipAt?: number;
  className?: string;
}) {
  const long = text.length > clipAt;
  return (
    <span data-slot="cell-tooltip" title={long ? text : undefined}
      className={cn("block max-w-full truncate", className)}>
      {text}
    </span>
  );
}
