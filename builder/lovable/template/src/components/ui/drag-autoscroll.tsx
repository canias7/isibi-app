import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The strips at the top and bottom of a scrollable area that scroll it while
 * you drag something over them.
 *
 * Without this, reordering row 2 to row 400 is impossible: the pointer is
 * holding an item, so it cannot also work the scrollbar or the wheel on a
 * trackpad drag. The list simply cannot be crossed.
 *
 * IT SCROLLS WITH `requestAnimationFrame`, NOT `setInterval`. An interval fires
 * on its own schedule and paints between frames, which is what makes so many of
 * these judder; rAF runs once per frame by definition and stops when the tab is
 * hidden.
 *
 * The zones are `pointer-events-none` when inactive, so they cannot swallow
 * ordinary clicks on the content underneath them — a permanently live 48px
 * strip across a list is a hit target nobody can explain.
 *
 * `aria-hidden`, and nothing announces it: this is a way to reach a position,
 * not a state worth reporting.
 */
export function DragAutoscroll({ containerRef, active, speed = 12, zone = 48, className }: {
  containerRef: React.RefObject<HTMLElement | null>;
  /** True while a drag is in progress. */
  active?: boolean;
  /** Pixels per frame. */
  speed?: number;
  /** Height of each strip. */
  zone?: number;
  className?: string;
}) {
  const dir = React.useRef(0);

  React.useEffect(() => {
    if (!active) { dir.current = 0; return; }
    let raf = 0;
    const step = () => {
      if (dir.current !== 0 && containerRef.current) {
        containerRef.current.scrollTop += dir.current * speed;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); dir.current = 0; };
  }, [active, speed, containerRef]);

  if (!active) return null;
  return (
    <>
      <div aria-hidden style={{ height: zone }}
        onPointerEnter={() => { dir.current = -1; }}
        onPointerLeave={() => { dir.current = 0; }}
        className={cn("absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background to-transparent", className)} />
      <div aria-hidden style={{ height: zone }}
        onPointerEnter={() => { dir.current = 1; }}
        onPointerLeave={() => { dir.current = 0; }}
        className={cn("absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background to-transparent", className)} />
    </>
  );
}
