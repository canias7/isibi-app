import { cn } from "@/lib/utils";
/**
 * The line showing where the thing will land.
 *
 * BETWEEN two rows, never on one. Highlighting the row you are hovering says
 * "it will go here" without saying above or below, and the reader finds out
 * which by dropping — a coin toss on every reorder. A line in the gap says
 * exactly one thing.
 *
 * It is `aria-hidden`, because a drag in progress is announced by the caller's
 * live region ("Full restoration, position 3 of 8"), and a decorative line
 * appearing in the accessibility tree mid-drag adds noise to the one moment
 * that needs to be clear.
 *
 * The dot at the leading edge is what makes a 2px line visible against a busy
 * list — the same reason every native file manager draws one.
 *
 * Horizontal by default, because lists are vertical and the line across them is
 * the common case; `orientation="vertical"` is for columns and boards.
 */
export function DropIndicator({ orientation = "horizontal", active = true, className }: {
  orientation?: "horizontal" | "vertical";
  active?: boolean;
  className?: string;
}) {
  if (!active) return null;
  const horizontal = orientation === "horizontal";
  return (
    <div aria-hidden
      className={cn("pointer-events-none relative", horizontal ? "h-0.5 w-full" : "h-full w-0.5", className)}>
      <div className={cn("absolute inset-0 bg-foreground")} />
      <div className={cn("absolute size-2 rounded-full border-2 border-foreground bg-background",
        horizontal ? "-top-0.75 -start-1" : "-top-1 -start-0.75")} />
    </div>
  );
}
