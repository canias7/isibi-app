import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Two images with a divider you drag between them — before and after.
 *
 * THE DIVIDER IS A NATIVE RANGE INPUT, not a draggable div. That single choice
 * gives keyboard operation, screen-reader semantics and OS pointer settings for
 * nothing — and it is why almost every before/after slider on the web is
 * unusable without a mouse.
 *
 * BOTH IMAGES CARRY REAL ALT TEXT and both are always in the DOM. Clipping one
 * with CSS keeps it available to a screen reader and to find-in-page; swapping
 * `src` on drag, which is the usual approach, makes the "before" image
 * unreachable to anybody not dragging.
 *
 * `aria-valuetext` says which side is showing rather than announcing "62", which
 * is a number about nothing.
 */
export function CompareSlider({ beforeSrc, beforeAlt, afterSrc, afterAlt, className }: {
  beforeSrc: string; beforeAlt: string;
  afterSrc: string; afterAlt: string;
  className?: string;
}) {
  const [pos, setPos] = React.useState(50);
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative overflow-hidden rounded-md border border-border">
        <img src={afterSrc} alt={afterAlt} className="block w-full" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img src={beforeSrc} alt={beforeAlt} className="block h-full w-auto max-w-none" />
        </div>
        <div aria-hidden className="absolute inset-y-0 w-0.5 bg-background" style={{ left: `${pos}%` }} />
      </div>
      <label htmlFor={id} className="sr-only">Compare before and after</label>
      <input id={id} type="range" min={0} max={100} value={pos}
        aria-valuetext={pos < 15 ? "Showing after" : pos > 85 ? "Showing before" : `${pos}% before`}
        onChange={(e) => setPos(Number(e.target.value))}
        className="w-full cursor-pointer accent-foreground" />
    </div>
  );
}
