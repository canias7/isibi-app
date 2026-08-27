import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A thin bar showing how far through the ARTICLE the reader is.
 *
 * IT MEASURES THE ARTICLE, NOT THE PAGE. Comments, related posts and a
 * footer below the piece mean page-scroll hits 70% when the words are
 * done — the classic version lies exactly at the end, where it matters.
 * The ref'd element's own top and height are the denominator.
 *
 * WRITES GO STRAIGHT TO THE NODE from a passive scroll listener via rAF
 * (the tilt-card rule) — progress ticks at scroll speed and a React
 * render per scroll event is the jank everyone then blames on the page.
 *
 * `aria-hidden`: the scrollbar already announces position; a live region
 * whispering percentages would be noise. Fixed to the viewport top, 2px,
 * ink on transparent — it should be legible and ignorable.
 */
export function ReadProgress({ articleRef, className }: {
  articleRef: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const bar = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const el = articleRef.current, b = bar.current;
      if (!el || !b) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const done = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      b.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [articleRef]);

  return (
    <div data-slot="read-progress" aria-hidden className={cn("pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5", className)}>
      <div ref={bar} className="h-full w-full origin-left bg-foreground" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
