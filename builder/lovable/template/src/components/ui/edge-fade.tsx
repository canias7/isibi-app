import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A scroll row whose edges fade ONLY where there is more.
 *
 * THE FADE IS A CLAIM — "content continues this way" — so a static
 * both-sides mask lies at both ends of the scroll. The mask is rebuilt
 * from scroll position (rAF-coalesced, the read-progress discipline):
 * at the left end only the right fades; at the right end only the
 * left; in the middle, both.
 *
 * mask-image gradients, so the fade works over ANY content and any
 * background without a matching-colour overlay strip (the overlay
 * version breaks the moment the background is not white).
 */
export function EdgeFade({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const canLeft = el.scrollLeft > 4;
      const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
      const from = canLeft ? "transparent, black 32px" : "black";
      const to = canRight ? "black calc(100% - 32px), transparent" : "black";
      const mask = `linear-gradient(to right, ${from}, ${to})`;
      el.style.maskImage = mask;
      (el.style as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage = mask;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", onScroll); ro?.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return (
    <div data-slot="edge-fade" ref={ref} className={cn("overflow-x-auto", className)}>
      {children}
    </div>
  );
}
