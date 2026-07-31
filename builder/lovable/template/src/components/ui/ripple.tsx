import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The circle that spreads from where a button was pressed.
 *
 * IT IS A `<span>` INSIDE THE BUTTON, never a wrapper around it. Wrapping
 * changes the layout — the button is no longer the flex or grid child its
 * parent styled — and every ripple implementation that wraps breaks alignment
 * somewhere in an existing design.
 *
 * `pointer-events-none` and `aria-hidden`, so it cannot swallow the click it is
 * reacting to. A ripple that intercepts the second press of a double-click is a
 * bug people describe as "the button sometimes doesn't work".
 *
 * Each ripple REMOVES ITSELF when its animation ends, listened for rather than
 * timed — a `setTimeout` that disagrees with the CSS duration either cuts the
 * animation short or leaves nodes behind, and the two get out of step the first
 * time somebody changes the duration.
 *
 * The parent needs `relative overflow-hidden`; that is stated because it is
 * the one thing a caller must do and forgetting it paints a circle across the
 * whole page.
 */
export function useRipple() {
  const [drops, setDrops] = React.useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const next = React.useRef(0);

  const onPointerDown = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    setDrops((xs) => [...xs, { id: next.current++, x: e.clientX - r.left, y: e.clientY - r.top, size }]);
  }, []);

  const done = React.useCallback((id: number) => setDrops((xs) => xs.filter((d) => d.id !== id)), []);
  return { drops, onPointerDown, done };
}

export function Ripple({ drops, onDone, className }: {
  drops: { id: number; x: number; y: number; size: number }[];
  onDone: (id: number) => void;
  className?: string;
}) {
  return (
    <>
      {drops.map((d) => (
        <span
          key={d.id}
          aria-hidden
          onAnimationEnd={() => onDone(d.id)}
          style={{ left: d.x - d.size / 2, top: d.y - d.size / 2, width: d.size, height: d.size }}
          className={cn("pointer-events-none absolute rounded-full bg-current opacity-20 motion-safe:animate-[ripple_600ms_ease-out] motion-reduce:hidden", className)}
        />
      ))}
      <style>{`@keyframes ripple {
        from { transform: scale(0); opacity: .25 }
        to { transform: scale(1); opacity: 0 }
      }`}</style>
    </>
  );
}
