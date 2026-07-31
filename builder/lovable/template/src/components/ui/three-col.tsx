import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Three columns that degrade 3 → 2 → 1 by breakpoint.
 *
 * NAMED BREAKPOINTS, NOT auto-fill: minmax auto-fill picks the column
 * count from the container, which sounds smarter and is — until a
 * 720px container renders two-and-a-bit columns of cards designed as
 * thirds. Cards designed for a 3-up want exactly 3, 2 or 1, and the
 * explicit ladder is the design decision made visible.
 *
 * `min-w-0` on items via the grid's own behaviour; equal-height rows
 * come free from grid, which is most of why this is not three floats.
 */
export function ThreeCol({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}
