import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Content that fades in as it scrolls into view.
 *
 * IT RENDERS VISIBLE WHEN THE API IS MISSING OR REDUCED MOTION IS SET. The
 * whole risk in this pattern is content trapped at `opacity: 0` forever — which
 * happens with no `IntersectionObserver`, in a print stylesheet, in a reader
 * view, and to anyone who has asked for less movement. Visible is the failure
 * state, hidden is the enhancement. `reveal` in this kit follows the same rule
 * and this is the scroll-linked sibling.
 *
 * IT REVEALS ONCE and then unobserves. Re-hiding on scroll-out means content
 * that flickers when somebody scrolls back up — and it keeps an observer alive
 * for every element on the page for the whole session.
 *
 * `rootMargin` fires it slightly BEFORE the element arrives, so the fade
 * finishes as it reaches the reader rather than starting then. An element that
 * begins animating once it is already fully visible reads as a lag.
 *
 * Anything above the fold should not use this at all — it delays the first
 * thing a visitor sees for an effect they will not witness.
 */
export function ScrollReveal({ children, delay = 0, rootMargin = "0px 0px -10% 0px", className }: {
  children: React.ReactNode;
  delay?: number;
  rootMargin?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Visible unless we can prove we can animate: the failure state must be
  // "shown", never "hidden forever".
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setHidden(true);
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHidden(false);
      io.disconnect();
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div data-slot="scroll-reveal"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn("transition-[opacity,transform] duration-(--dur-4) motion-reduce:transition-none",
        hidden ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100", className)}
    >
      {children}
    </div>
  );
}
