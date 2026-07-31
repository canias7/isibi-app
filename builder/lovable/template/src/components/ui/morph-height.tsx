import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A container that animates smoothly as its content grows or shrinks.
 *
 * `height: auto` CANNOT BE ANIMATED by CSS transitions — that is the whole
 * problem this solves, and the reason every accordion on the web either jumps
 * or hard-codes a max-height. A `ResizeObserver` measures the content and the
 * height is set in pixels, which transitions perfectly.
 *
 * IT RETURNS TO `auto` once the transition ends. Left pinned to a pixel value,
 * the box stops responding to anything that changes its content later — a
 * window resize reflowing the text, a font loading, an image arriving — and
 * clips it silently.
 *
 * `max-height` with a guessed large value is the usual shortcut and it is
 * visibly wrong: the easing applies to the guess, so a short panel snaps open
 * and a tall one crawls.
 *
 * `prefers-reduced-motion` skips the transition and resizes instantly. Nothing
 * is lost; the content is the content.
 */
export function MorphHeight({ children, duration = 240, className }: {
  children: React.ReactNode;
  duration?: number;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const first = React.useRef(true);

  React.useEffect(() => {
    const outer = box.current, content = inner.current;
    if (!outer || !content || typeof ResizeObserver === "undefined") return;

    const apply = () => {
      const next = content.offsetHeight;
      if (first.current) { first.current = false; outer.style.height = "auto"; return; }
      const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) { outer.style.height = "auto"; return; }
      // From the current pixel height to the new one, then back to auto so the
      // box keeps responding to anything that changes it later.
      outer.style.height = `${outer.offsetHeight}px`;
      requestAnimationFrame(() => {
        outer.style.transition = `height ${duration}ms ease`;
        outer.style.height = `${next}px`;
      });
    };

    const ro = new ResizeObserver(apply);
    ro.observe(content);
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "height") return;
      outer.style.transition = "";
      outer.style.height = "auto";
    };
    outer.addEventListener("transitionend", onEnd);
    return () => { ro.disconnect(); outer.removeEventListener("transitionend", onEnd); };
  }, [duration]);

  return (
    <div ref={box} className={cn("overflow-hidden", className)}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
