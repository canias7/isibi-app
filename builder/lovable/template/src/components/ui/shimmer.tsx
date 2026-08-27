import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The moving sheen over a loading placeholder.
 *
 * IT ONLY EXISTS PAST A DELAY. A shimmer that appears for 80ms and vanishes is
 * worse than nothing — the flash draws the eye to a load that was too fast to
 * matter. Below `delay` nothing renders at all, which is the treatment most
 * loads deserve.
 *
 * `prefers-reduced-motion` gets a STATIC placeholder, not nothing: the shape
 * still says "content is coming", and only the sweep is decoration.
 *
 * `aria-hidden` always, with the loading state announced ONCE by the container
 * (`aria-busy`), never by the placeholder itself — a screen reader has no use
 * for a description of grey boxes.
 *
 * The sweep is a CSS keyframe on `background-position` of a gradient — no
 * JavaScript per frame, compositor-friendly, and it stops the moment the
 * element leaves the DOM.
 */
export function Shimmer({ delay = 300, className, children }: {
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const [show, setShow] = React.useState(delay === 0);
  React.useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return null;
  return (
    <div data-slot="shimmer" aria-hidden className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
      <div className="absolute inset-0 motion-safe:animate-[shimmer-sweep_1.6s_ease-in-out_infinite] motion-safe:bg-[linear-gradient(100deg,transparent_30%,var(--background)_50%,transparent_70%)] motion-safe:opacity-60" />
      {children}
      <style>{`@keyframes shimmer-sweep {
        from { transform: translateX(-100%) }
        to { transform: translateX(100%) }
      }`}</style>
    </div>
  );
}
