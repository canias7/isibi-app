import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A button that leans towards the pointer as it approaches.
 *
 * THE PULL IS SMALL AND CAPPED. Past a few pixels the button is no longer where
 * it looks like it is, and a control that moves away from a click is the exact
 * opposite of what a button is for — it becomes a game. 6px is enough to be
 * felt and not enough to miss.
 *
 * MOUSE ONLY, like `tilt-card`: a touch has no approach, so the effect would
 * fire on the tap itself and leave the button offset afterwards.
 *
 * It resets on leave, on blur AND on click. Without the click reset a button
 * that opens a dialog stays displaced behind it and is in the wrong place when
 * the dialog closes.
 *
 * `prefers-reduced-motion` disables it. This is decoration on a control that is
 * perfectly usable still.
 *
 * It renders a `<span>` wrapper and moves THAT, so the child button keeps its
 * own layout and styling — the same rule `ripple` follows about never wrapping
 * in a way that changes what the parent laid out.
 */
export function MagneticButton({ strength = 6, children, className }: {
  strength?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduced = React.useRef(false);
  const pull = Math.max(0, Math.min(12, strength));

  React.useEffect(() => {
    reduced.current = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const rest = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 260ms cubic-bezier(.2,.8,.2,1)";
    el.style.transform = "";
  };

  return (
    <span
      ref={ref}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || reduced.current) return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.transition = "none";
        el.style.transform = `translate(${(dx * pull).toFixed(1)}px, ${(dy * pull).toFixed(1)}px)`;
      }}
      onPointerLeave={rest}
      onBlur={rest}
      onClick={rest}
      className={cn("inline-block will-change-transform motion-reduce:transform-none!", className)}
    >
      {children}
    </span>
  );
}
