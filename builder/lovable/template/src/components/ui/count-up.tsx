import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A number that counts up to its value.
 *
 * THE FINAL VALUE IS IN THE DOM FROM THE FIRST FRAME, as `sr-only` text, and
 * the animated digits are `aria-hidden`. A screen reader on a live region full
 * of changing numbers reads a stream of nonsense; a crawler that does not run
 * the animation indexes "0". Both are fixed by having the real number present
 * and stable throughout.
 *
 * `prefers-reduced-motion` renders the value immediately. The animation is
 * decoration on a number that is the content.
 *
 * It EASES OUT and finishes exactly on the target — no floating-point drift, no
 * "1,247.0000001". The last frame assigns the target rather than computing it.
 *
 * `tabular-nums` throughout, or the digits change width as they roll and the
 * whole line jitters sideways — which is the thing that makes a counter look
 * cheap.
 *
 * IT ANIMATES ON MOUNT, from `from` (0 by default). The first version seeded
 * its starting point with the target, so the effect saw no change and returned
 * immediately — a component called count-up that only ever counted when the
 * number later changed, which is not what anybody reaches for it to do. It
 * still animates on a later change, from wherever it currently is.
 */
export function CountUp({ value, from: start0 = 0, duration = 900, format, className }: {
  value: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [shown, setShown] = React.useState(start0);
  const from = React.useRef(start0);
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());

  React.useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof requestAnimationFrame === "undefined") {
      from.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / duration);
      if (p >= 1) {
        // Assign the target rather than computing it, or the last frame lands
        // on 1246.9999999.
        from.current = value;
        setShown(value);
        return;
      }
      const eased = 1 - (1 - p) ** 3;
      setShown(start + (value - start) * eased);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden>{fmt(shown)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  );
}
