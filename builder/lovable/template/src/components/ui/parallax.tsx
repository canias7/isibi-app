import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Background that moves slower than the page.
 *
 * DRIVEN BY `animation-timeline: view()`, so there is no scroll listener, no
 * `requestAnimationFrame`, and no `getBoundingClientRect`. The previous version
 * did all three: it read layout inside a frame on every scroll event, for every
 * parallax element on the page. That read is a forced synchronous layout, it is
 * the single most common cause of a page that scrolls badly on a phone, and the
 * elaborate care it needed — an IntersectionObserver gate, a rAF guard, three
 * listeners and a four-line teardown — existed entirely to make it survivable.
 * A scroll-driven animation runs off the main thread and needs none of it.
 *
 * `@supports` IS LOAD-BEARING, NOT DECORATION. Where the timeline is missing the
 * rule is skipped, the element keeps its natural position, and the section reads
 * as a normal background. Without the guard the same keyframes would attach to
 * the document timeline and play ONCE on load — the background would slide to
 * its end position and stay there, off-register, on exactly the browsers that
 * could not do the effect.
 *
 * `prefers-reduced-motion` disables it and the content sits still. Parallax is a
 * large background movement decoupled from the reader's input, which is close to
 * the definition of what triggers motion sickness.
 *
 * `speed` is capped, because past about 0.4 the background visibly detaches from
 * the page and the effect reads as a bug rather than as depth.
 */
export function Parallax({ speed = 0.2, children, className }: {
  speed?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const rate = Math.max(-0.4, Math.min(0.4, speed));
  // The travel is expressed as a share of the element's own height, so the
  // effect holds at any size — the old version derived it from the viewport and
  // had to recompute on resize.
  const shift = (rate * 50).toFixed(2) + "%";

  return (
    <div data-slot="parallax"
      className={cn("parallax relative overflow-hidden", className)}
      style={{ "--parallax-shift": shift } as React.CSSProperties}
    >
      <div className="parallax-layer">{children}</div>
    </div>
  );
}
