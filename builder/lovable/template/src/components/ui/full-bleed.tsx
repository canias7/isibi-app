import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Break one section out of a centred column to the viewport edge.
 *
 * THE CALC TRICK — `margin-inline: calc(50% - 50vw)` — escapes any
 * centred parent without knowing its width. The known caveat is stated
 * rather than hidden: 100vw includes the scrollbar, so a full-bleed
 * section can cause ~15px of horizontal scroll on Windows; the wrapper
 * sets `overflow-x: clip` on itself as the containment, which is the
 * cheap fix that does not require touching the page root.
 *
 * Content INSIDE the bleed usually wants the page's gutter back —
 * `inner` re-applies it, because edge-to-edge text is a poster, not a
 * paragraph.
 */
export function FullBleed({ inner = true, children, className }: {
  inner?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div style={{ marginInline: "calc(50% - 50vw)" }} className={cn("overflow-x-clip", className)}>
      {inner ? <div className="px-4 sm:px-6 lg:px-8">{children}</div> : children}
    </div>
  );
}
