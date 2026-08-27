import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * "Swipe a row for more" — the hint for a hidden row action.
 *
 * THE DIFFERENCE FROM `touch-hint` IS WHAT IS HIDDEN. That one says the content
 * continues sideways; this says an ACTION exists — swipe a row to archive it —
 * which is completely undiscoverable and has no visual affordance at all. It
 * therefore also names the action rather than just the gesture.
 *
 * IT ALWAYS NAMES THE OTHER WAY TO DO IT. A destructive action reachable only
 * by swipe is unreachable by keyboard, by switch control, and by anybody who
 * does not know the gesture — so the hint doubles as the pointer to the menu
 * that also does it.
 *
 * IT DISAPPEARS ONCE THE GESTURE HAS BEEN USED, on the caller's say-so. A
 * permanent instruction under a list is clutter after the first day.
 *
 * COARSE POINTER ONLY, and `aria-hidden` — a screen reader user does not swipe,
 * and the alternative route is the one that matters to them, which the caller
 * exposes as an ordinary button.
 */
export function SwipeHint({ action = "more options", alternative = "the ⋯ menu", seen, className }: {
  /** What the swipe reveals — "archive". */
  action?: string;
  /** The other way — "the ⋯ menu". */
  alternative?: string;
  /** True once the caller knows the gesture has been used. */
  seen?: boolean;
  className?: string;
}) {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  if (!touch || seen) return null;
  return (
    <p data-slot="swipe-hint" aria-hidden="true" className={cn("text-xs text-muted-foreground", className)}>
      Swipe a row for {action} — or use {alternative}.
    </p>
  );
}
