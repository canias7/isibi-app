import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The moment after something genuinely worth marking — a first booking taken, a
 * setup finished.
 *
 * IT RENDERS NOTHING UNDER `prefers-reduced-motion` except the message. The
 * animation is a burst of moving particles across the viewport, which is the
 * textbook trigger for vestibular disorders, and the words carry the whole
 * meaning.
 *
 * Plain CSS keyframes on a dozen absolutely-positioned squares — no animation
 * runtime. Every registry that sells a confetti component ships ~50 KB of
 * library for an effect that is two keyframes.
 *
 * It CLEANS ITSELF UP after the animation, so a page that fires this on every
 * save does not accumulate a hundred stale nodes.
 *
 * It is `pointer-events-none` over the whole area. Celebration that intercepts
 * a click on the button underneath it turns a good moment into a bug report.
 *
 * Use it rarely. The second time it fires for the same person it means nothing,
 * and the fourth is an irritation.
 */
export function Celebration({ show, message, onDone, pieces = 14, duration = 1400, className }: {
  show: boolean;
  message?: React.ReactNode;
  onDone?: () => void;
  pieces?: number;
  duration?: number;
  className?: string;
}) {
  const [alive, setAlive] = React.useState(false);
  // Out of the deps: an inline `onDone` re-armed the timeout on every
  // parent render, so the celebration could run past its own duration.
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    if (!show) return;
    setAlive(true);
    const t = setTimeout(() => { setAlive(false); doneRef.current?.(); }, duration);
    return () => clearTimeout(t);
  }, [show, duration]);

  if (!show) return null;

  return (
    <div data-slot="celebration" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {alive ? (
        <div aria-hidden className="motion-reduce:hidden">
          {Array.from({ length: pieces }, (_, i) => {
            // Deterministic spread — no Math.random, so a re-render does not
            // reshuffle the burst mid-flight.
            const left = ((i * 37) % 100) + (i % 3);
            const delay = (i % 5) * 60;
            const spin = i % 2 ? 220 : -180;
            return (
              <span
                key={i}
                style={{
                  left: `${left}%`,
                  animation: `celebration-fall ${duration}ms ${delay}ms ease-in forwards`,
                  ["--spin" as string]: `${spin}deg`,
                }}
                className={cn("absolute top-0 block size-1.5",
                  i % 3 === 0 ? "bg-foreground" : i % 3 === 1 ? "border border-foreground" : "rounded-full bg-muted-foreground")}
              />
            );
          })}
          <style>{`@keyframes celebration-fall {
            0% { transform: translateY(-10%) rotate(0deg); opacity: 1 }
            100% { transform: translateY(340%) rotate(var(--spin)); opacity: 0 }
          }`}</style>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="absolute inset-x-0 top-1/3 text-center text-sm font-semibold">{message}</p>
      ) : null}
    </div>
  );
}
