import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The footer sits at the BOTTOM of short pages — not halfway up.
 *
 * `min-h-svh` + flex column + `mt-auto` on the footer: the whole
 * pattern. svh, not vh — on phones 100vh includes the space under the
 * collapsing URL bar, so a vh footer starts hidden and jumps when the
 * bar shrinks (the app-shell lesson).
 *
 * A short page's footer floating at 60% height reads as a broken page;
 * a long page is unaffected — mt-auto only has slack to absorb when
 * the content runs short.
 */
export function StickyFooter({ children, footer, className }: {
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="sticky-footer" className={cn("flex min-h-svh flex-col", className)}>
      <div className="flex-1">{children}</div>
      <footer className="mt-auto">{footer}</footer>
    </div>
  );
}
