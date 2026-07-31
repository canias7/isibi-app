import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Background that moves slower than the page.
 *
 * IT MOVES ONLY WHILE ON SCREEN, gated by an `IntersectionObserver`. A scroll
 * handler that runs for every parallax element on a long page, whether visible
 * or not, is the single most common cause of a page that scrolls badly on a
 * phone.
 *
 * The transform is written in a `requestAnimationFrame`, not in the scroll
 * handler. Writing a style inside a scroll listener forces layout on every
 * scroll event — dozens a second — and produces exactly the jank the effect is
 * meant to be worth.
 *
 * `prefers-reduced-motion` disables it entirely and the content sits still.
 * Parallax is a large background movement decoupled from the reader's input,
 * which is close to the definition of what triggers motion sickness.
 *
 * `speed` is capped, because past about 0.4 the background visibly detaches
 * from the page and the effect reads as a bug rather than as depth.
 */
export function Parallax({ speed = 0.2, children, className }: {
  speed?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const rate = Math.max(-0.4, Math.min(0.4, speed));

  React.useEffect(() => {
    const el = ref.current, box = inner.current;
    if (!el || !box) return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    let visible = false, raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const middle = r.top + r.height / 2 - window.innerHeight / 2;
      box.style.transform = `translate3d(0, ${(-middle * rate).toFixed(1)}px, 0)`;
    };
    // The write goes in a frame, never in the scroll handler itself.
    const onScroll = () => { if (visible && !raf) raf = requestAnimationFrame(paint); };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) onScroll();
    }, { rootMargin: "100px" });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rate]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <div ref={inner} className="will-change-transform motion-reduce:transform-none">{children}</div>
    </div>
  );
}
