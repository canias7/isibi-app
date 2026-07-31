import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A narrow fixed strip down one side — icons only, a workspace switcher.
 *
 * FULL HEIGHT and its own scroll, so the rail never scrolls away with the
 * page. A sidebar that disappears when you scroll is the commonest complaint
 * about app shells built from ordinary flow layout.
 *
 * Below `md` it becomes a horizontal strip along the bottom rather than
 * vanishing — a rail hidden on a phone takes the only navigation with it.
 *
 * IT MUST BE A CHILD OF A FULL-HEIGHT FLEX ROW. `md:h-svh` in ordinary page
 * flow produces a screen-tall empty column after the content instead of a
 * side rail — seen exactly that way the first time this was rendered. The
 * shape it wants is `<div className="flex min-h-svh"><Rail/><main/></div>`.
 */
export function Rail({ children, side = "left", className }: {
  children?: React.ReactNode; side?: "left" | "right"; className?: string;
}) {
  return (
    <nav aria-label="Sections"
      className={cn(
        "flex shrink-0 gap-1 border-border bg-background",
        "fixed inset-x-0 bottom-0 z-30 justify-around border-t p-1",
        "md:sticky md:top-0 md:inset-x-auto md:bottom-auto md:h-svh md:w-14 md:flex-col md:justify-start md:overflow-y-auto md:p-2",
        side === "left" ? "md:border-r md:border-t-0" : "md:order-last md:border-l md:border-t-0",
        className)}>
      {children}
    </nav>
  );
}
