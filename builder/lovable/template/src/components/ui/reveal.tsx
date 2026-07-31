import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Fades its children in as they arrive.
 *
 * IntersectionObserver and a CSS transition — no animation library. Respects
 * `prefers-reduced-motion` by rendering visible from the start, and renders
 * visible where the API is missing, so content can never be trapped invisible.
 */
export function Reveal({ delay = 0, className, children }: {
  delay?: number; className?: string; children?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: delay + "ms" }}
      className={cn("transition-all duration-(--dur-4)", shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2", className)}>
      {children}
    </div>
  );
}
