import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A card that tips towards the pointer.
 *
 * MOUSE ONLY. A touch has no hover, so on a phone the tilt would fire on the
 * tap that was meant to follow the link and leave the card stuck at an angle —
 * `e.pointerType === "mouse"` is the whole guard, and skipping it is why so
 * many of these feel broken on a phone.
 *
 * The style is written DIRECTLY to the node, not through React state. A tilt
 * updates on every pointer move; routing that through a re-render means React
 * reconciles the subtree dozens of times a second for a decorative transform.
 *
 * It RESETS on leave and on blur, with a transition only on the reset. Easing
 * the tracking makes the card lag the pointer, which feels like slow software;
 * easing the return makes it settle instead of snapping.
 *
 * `prefers-reduced-motion` disables it, and the card works untouched — it is
 * one transform on a container that is otherwise perfectly ordinary.
 */
export function TiltCard({ max = 8, scale = 1.01, children, className }: {
  max?: number;
  scale?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = React.useRef(false);

  React.useEffect(() => {
    reduced.current = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || reduced.current) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transition = "none";
    el.style.transform =
      `perspective(800px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) scale(${scale})`;
  };
  const rest = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 240ms ease-emphasis";
    el.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={rest}
      onBlur={rest}
      className={cn("will-change-transform motion-reduce:transform-none!", className)}
    >
      {children}
    </div>
  );
}
