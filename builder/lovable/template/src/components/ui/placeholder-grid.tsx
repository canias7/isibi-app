import * as React from "react";
import { Shimmer } from "@/components/ui/shimmer";
import { cn } from "@/lib/utils";
/**
 * The placeholder a card grid shows while it loads.
 *
 * CARD COUNT AND ASPECT MATCH THE REAL GRID, for the no-jump contract every
 * skeleton here follows. The aspect ratio is the important half on a grid —
 * cards of photographs are square or 4/3, and a text-height placeholder
 * collapses the rows on arrival.
 *
 * IT USES THE SAME GRID CLASSES as the content will, taken as a prop, rather
 * than approximating them. Two grids that "look similar" drift the moment the
 * breakpoint changes, and the swap jumps sideways instead of not at all.
 *
 * Everything else — the delay, reduced motion, aria — is `shimmer`'s and is
 * not restated.
 */
export function PlaceholderGrid({ count = 6, aspect = "4/3", gridClassName, withText = true, delay, className }: {
  count?: number;
  aspect?: string;
  gridClassName?: string;
  withText?: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      <p className="sr-only">Loading</p>
      <Shimmer delay={delay} className="bg-transparent">
        <div className={cn(gridClassName ?? "grid grid-cols-2 gap-3 sm:grid-cols-3")}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <span style={{ aspectRatio: aspect }} className="w-full rounded-md bg-muted" />
              {withText ? (
                <>
                  <span className={cn("h-3 rounded bg-muted", i % 2 ? "w-3/4" : "w-3/5")} />
                  <span className="h-2.5 w-2/5 rounded bg-muted" />
                </>
              ) : null}
            </div>
          ))}
        </div>
      </Shimmer>
    </div>
  );
}
