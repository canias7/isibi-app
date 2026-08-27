import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Defers rendering its children until they are nearly on screen.
 *
 * IT RESERVES ITS HEIGHT while deferred. A lazy section with no reserved space
 * makes the scrollbar lie — the page "grows" as you scroll and the thumb jumps
 * — and it defeats the browser's scroll anchoring. `estimatedHeight` is
 * required for exactly that reason; there is no honest default.
 *
 * IT RENDERS EVERYTHING WHEN THE API IS MISSING, the same fail-visible rule as
 * `scroll-reveal`: deferral is an optimisation, and content trapped unrendered
 * for want of IntersectionObserver is the failure state this must never have.
 *
 * ONCE MOUNTED, ALWAYS MOUNTED. Unmounting on scroll-out throws away form
 * state, video position and focus inside the section — the moment somebody
 * scrolls back it is a different page. Mounting is one-way.
 *
 * `rootMargin` defaults generous (one viewport), because the point is to have
 * finished mounting BEFORE arrival, not to begin at it.
 */
export function LazyBoundary({ estimatedHeight, rootMargin = "100% 0px", children, className }: {
  estimatedHeight: number;
  rootMargin?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    // No observer means render everything: deferral is an optimisation.
    if (typeof IntersectionObserver === "undefined") { setMounted(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setMounted(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div data-slot="lazy-boundary" ref={ref} className={className}
      style={mounted ? undefined : { minHeight: estimatedHeight }}>
      {mounted ? children : null}
    </div>
  );
}
