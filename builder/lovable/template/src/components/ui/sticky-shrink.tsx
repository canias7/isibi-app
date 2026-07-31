import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A header that shrinks once the page has scrolled.
 *
 * IT USES A SENTINEL AND AN `IntersectionObserver`, not a scroll handler.
 * Reading `scrollY` on every scroll event and setting state means React
 * re-renders the whole header dozens of times a second; a sentinel above the
 * header fires exactly twice — once when it leaves, once when it comes back.
 *
 * PASS `root` WHEN THE HEADER IS INSIDE A SCROLLING BOX rather than on the
 * page. An observer with no root measures against the viewport, so an instance
 * that is simply below the fold reports "scrolled" while its own container sits
 * at the top — measured exactly that way, a header rendered shrunk before
 * anybody had touched it.
 *
 * There is HYSTERESIS built in by the sentinel's height: it shrinks after a few
 * pixels and only restores at the very top, so a header sitting exactly on the
 * boundary cannot flicker between the two states as the page settles.
 *
 * The height change is a TRANSITION on the container, and the content does not
 * re-flow — nothing is removed, only scaled and spaced. A header that swaps its
 * contents on scroll makes the whole page jump, and any focus inside it is lost.
 *
 * `prefers-reduced-motion` gets the same two states with no easing.
 */
export function StickyShrink({ children, root, shrunkClassName, className }: {
  children: React.ReactNode | ((shrunk: boolean) => React.ReactNode);
  root?: React.RefObject<HTMLElement | null>;
  shrunkClassName?: string;
  className?: string;
}) {
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [shrunk, setShrunk] = React.useState(false);

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Fires twice, not on every scroll event. `root` is the scrolling box when
    // there is one, or the viewport is used and being below the fold reads as
    // being scrolled.
    const io = new IntersectionObserver(([entry]) => setShrunk(!entry.isIntersecting),
      root?.current ? { root: root.current } : undefined);
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-4" />
      <div
        data-shrunk={shrunk || undefined}
        className={cn("sticky top-0 z-30 border-b border-border bg-background transition-[padding,box-shadow] duration-(--dur-2) motion-reduce:transition-none",
          shrunk ? cn("py-1.5 shadow-sm", shrunkClassName) : "py-3", className)}
      >
        {typeof children === "function" ? children(shrunk) : children}
      </div>
    </>
  );
}
