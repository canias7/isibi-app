import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A header that stays put, and knows when it is stuck.
 *
 * `position: sticky` is trivial; knowing you have BECOME stuck is not, and it is
 * what lets the shadow appear only when there is content underneath. An
 * IntersectionObserver on a zero-height sentinel is the only way to detect it
 * without listening to every scroll event.
 *
 * THE OBSERVER IS TORN DOWN ON UNMOUNT, and rootMargin accounts for the offset
 * so the state flips exactly when the header meets its resting place rather than
 * a pixel early.
 *
 * `offset` exists because sticky elements stack — a header under an announcement
 * bar has to know how far down it sits, and hard-coding `top-0` is what makes
 * two sticky things overlap.
 */
export function StickyHeader({ children, offset = 0, className }: {
  children: React.ReactNode;
  /** Pixels from the top — leave room for anything sticky above. */
  offset?: number;
  className?: string;
}) {
  const [stuck, setStuck] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      rootMargin: `-${offset + 1}px 0px 0px 0px`,
      threshold: [1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [offset]);
  return (
    <>
      <div ref={sentinel} aria-hidden style={{ top: offset }} className="sticky h-0" />
      <div style={{ top: offset }}
        className={cn("sticky z-20 bg-background transition-shadow", stuck && "shadow-xs border-b border-border", className)}>
        {children}
      </div>
    </>
  );
}
