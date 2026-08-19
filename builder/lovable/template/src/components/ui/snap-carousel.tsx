import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, scrollBehavior } from "@/lib/utils";
/**
 * A horizontal carousel built on the browser's own scrolling.
 *
 * CSS scroll-snap, no library, no autoplay, no interval. A swipe works because
 * it IS scrolling, momentum and rubber-banding included, which no
 * JavaScript reimplementation matches. Same reasoning as `image-strip`.
 *
 * NO AUTOPLAY, deliberately. A carousel that advances on a timer moves the
 * thing somebody was reading, and it is the single most complained-about
 * pattern on the web. The arrows and a swipe are the whole interface.
 *
 * The arrows DISABLE at the ends rather than wrapping. In a scroll container
 * there is no way to wrap smoothly — it would jump the scroll position across
 * the whole width — and a dead-ended scroll is what people expect from a strip
 * they can see the edges of.
 *
 * The dots are BUTTONS with real labels, not decoration, so the position is
 * both visible and reachable. `scroll-behavior: smooth` respects reduced motion
 * automatically in every current browser.
 *
 * "Current" is the FIRST ITEM AT THE LEFT EDGE, not the one nearest the middle.
 * A strip usually shows several items at once, and picking the centred one lit
 * the third dot on an untouched carousel — measured — which reads as a
 * carousel that has scrolled itself. The leading edge is also what "next"
 * should advance from.
 */
export function SnapCarousel({ children, label = "Carousel", showDots = true, className }: {
  children: React.ReactNode;
  label?: string;
  showDots?: boolean;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const [ends, setEnds] = React.useState({ start: true, end: false });

  const measure = React.useCallback(() => {
    const el = box.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    setCount(kids.length);
    let best = 0, bestD = Infinity;
    kids.forEach((k, i) => {
      const d = Math.abs(k.offsetLeft - el.scrollLeft);
      if (d < bestD) { bestD = d; best = i; }
    });
    setAt(best);
    setEnds({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  React.useEffect(() => { measure(); }, [measure, children]);

  const go = (d: -1 | 1) => {
    const el = box.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const next = kids[Math.max(0, Math.min(kids.length - 1, at + d))];
    if (next) el.scrollTo({ left: next.offsetLeft, behavior: scrollBehavior() });
  };
  const jump = (i: number) => {
    const el = box.current;
    const kid = (el?.children[i] as HTMLElement | undefined);
    if (el && kid) el.scrollTo({ left: kid.offsetLeft, behavior: scrollBehavior() });
  };

  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-roledescription="carousel" aria-label={label}>
      <div className="relative">
        <div ref={box} onScroll={measure}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        <button type="button" onClick={() => go(-1)} disabled={ends.start} aria-label="Previous"
          className="absolute top-1/2 start-1 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-border bg-popover shadow-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-0">
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button type="button" onClick={() => go(1)} disabled={ends.end} aria-label="Next"
          className="absolute top-1/2 end-1 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-border bg-popover shadow-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-0">
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      {showDots && count > 1 ? (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} type="button" onClick={() => jump(i)}
              aria-label={`Go to item ${i + 1} of ${count}`} aria-current={i === at ? "true" : undefined}
              className={cn("size-1.5 cursor-pointer rounded-full",
                i === at ? "bg-foreground" : "bg-muted-foreground/40 hover:bg-muted-foreground")} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
