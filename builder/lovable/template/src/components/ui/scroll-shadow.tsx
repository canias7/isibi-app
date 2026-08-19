import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The edge shading that says "there is more this way".
 *
 * A SCROLLABLE BOX WITH NO CUE LOOKS LIKE A FULL ONE. This is the commonest
 * cause of "the rest of the table is missing" — a wide table on a narrow screen
 * scrolls perfectly and nothing suggests it can.
 *
 * SHADOWS APPEAR ONLY ON THE SIDES THAT HAVE CONTENT, checked on scroll and on
 * resize. A permanent gradient at both ends is worse than none: it says there is
 * more when there is not.
 *
 * The check runs once on mount too, because a box that starts already scrolled —
 * restored position, an anchor jump — would otherwise show no shadow until the
 * reader moves it.
 */
export function ScrollShadow({ children, orientation = "horizontal", className }: {
  children: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });
  const h = orientation === "horizontal";

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const pos = h ? el.scrollLeft : el.scrollTop;
      const size = h ? el.clientWidth : el.clientHeight;
      const total = h ? el.scrollWidth : el.scrollHeight;
      setEdges({ start: pos > 1, end: pos + size < total - 1 });
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", check); ro?.disconnect(); };
  }, [h]);

  return (
    <div className="relative">
      <div ref={ref} className={cn(h ? "overflow-x-auto" : "overflow-y-auto", className)}>{children}</div>
      {edges.start && (
        <div aria-hidden className={cn("pointer-events-none absolute from-background to-transparent",
          h ? "inset-y-0 start-0 w-6 bg-gradient-to-r" : "inset-x-0 top-0 h-6 bg-gradient-to-b")} />
      )}
      {edges.end && (
        <div aria-hidden className={cn("pointer-events-none absolute from-background to-transparent",
          h ? "inset-y-0 end-0 w-6 bg-gradient-to-l" : "inset-x-0 bottom-0 h-6 bg-gradient-to-t")} />
      )}
    </div>
  );
}
