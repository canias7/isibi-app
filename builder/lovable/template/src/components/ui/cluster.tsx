import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Things of unequal width, wrapped, evenly gapped — tags, buttons, filters.
 *
 * The layout nobody should write by hand again. `flex flex-wrap` with a gap
 * is right, and the reason it goes in the kit is that the alternative people
 * reach for — margins on the children — double up between rows and leave a
 * ragged trailing margin at the end of each line.
 */
export function Cluster({ gap = "sm", align = "center", justify = "start", children, className }: {
  gap?: "xs" | "sm" | "md" | "lg"; align?: "start" | "center" | "end" | "baseline";
  justify?: "start" | "center" | "end" | "between";
  children?: React.ReactNode; className?: string;
}) {
  const g = { xs: "gap-1", sm: "gap-2", md: "gap-3", lg: "gap-4" }[gap];
  const a = { start: "items-start", center: "items-center", end: "items-end", baseline: "items-baseline" }[align];
  const j = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" }[justify];
  return <div data-slot="cluster" className={cn("flex flex-wrap", g, a, j, className)}>{children}</div>;
}
