import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * A block of a page that only renders once it is nearly scrolled to.
 *
 * IT RESERVES ITS HEIGHT BEFORE IT LOADS, which is the whole difference between
 * this and a bare observer. Without `minHeight` the placeholder is zero-tall,
 * the page below jumps up, and the scrollbar changes length on every section —
 * so scrolling fast lands somewhere random. That is layout shift, and it is the
 * standard cost of lazy sections.
 *
 * IT RENDERS EAGERLY WHEN THERE IS NO OBSERVER. A section that stays blank
 * because the API is missing has hidden real content permanently — the same
 * discipline `reveal` follows. Deferred rendering is an optimisation; the
 * content is the point.
 *
 * ONCE SHOWN IT STAYS SHOWN. Unmounting on scroll-away destroys any state
 * inside — a half-typed form, an open accordion — and the flicker of remounting
 * costs more than it saves.
 *
 * `children` IS A FUNCTION so the subtree is not constructed until it is
 * needed; taking a node would build the whole thing immediately and defer only
 * the paint.
 */
export function LazySection({ children, minHeight = 200, rootMargin = "300px", className }: {
  children: () => React.ReactNode;
  /** Reserved while it is unloaded, in pixels. */
  minHeight?: number;
  rootMargin?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(typeof IntersectionObserver === "undefined");
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown(true);
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);
  return (
    <div data-slot="lazy-section" ref={ref} className={className} style={shown ? undefined : { minHeight }}>
      {shown ? children() : null}
    </div>
  );
}
