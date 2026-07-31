import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A horizontal row of cards that scrolls — "more like this", a category strip.
 *
 * SCROLL-SNAP, not a carousel. The browser's own scrolling means a swipe
 * works on a phone with no JavaScript, no arrows to mis-hit, and the whole
 * row is reachable by keyboard because it is just a scroll container. Every
 * carousel library is a great deal of code to make this worse.
 *
 * `scroll-pl` keeps the first card off the very edge when snapped, which is
 * what stops it looking clipped.
 */
export function Shelf({ children, itemWidth = "16rem", className }: {
  children?: React.ReactNode; itemWidth?: string; className?: string;
}) {
  return (
    <div className={cn("-mx-4 overflow-x-auto scroll-pl-4 px-4 pb-2 [scroll-snap-type:x_mandatory]", className)}>
      <div className="flex gap-3">
        {React.Children.map(children, (c) => (
          <div className="shrink-0 [scroll-snap-align:start]" style={{ width: itemWidth }}>{c}</div>
        ))}
      </div>
    </div>
  );
}
