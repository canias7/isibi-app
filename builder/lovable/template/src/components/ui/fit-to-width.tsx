import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Shrink something rigid so it fits the space it has.
 *
 * FOR CONTENT WITH A FIXED WIDTH that cannot reflow — a floor plan, a wide
 * table, an embedded document. The alternative on a phone is a horizontal
 * scrollbar, and for something meant to be seen whole that is the wrong answer.
 *
 * IT ONLY EVER SCALES DOWN. Blowing a 600px diagram up to fill a desktop makes
 * it blurry and is never what the author wanted; the scale is capped at 1.
 *
 * `transform` rather than zoom, because zoom is not in the spec and behaves
 * differently across browsers — and the wrapper's height is corrected for the
 * scale, since a transform does not affect layout and would otherwise leave a
 * gap the size of the unscaled element.
 */
export function FitToWidth({ contentWidth, children, className }: {
  /** The natural width of the content, in pixels. */
  contentWidth: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || contentWidth <= 0) return;
    const fit = () => setScale(Math.min(el.clientWidth / contentWidth, 1));
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [contentWidth]);
  return (
    <div data-slot="fit-to-width" ref={ref} className={cn("overflow-hidden", className)}>
      <div style={{ width: contentWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
