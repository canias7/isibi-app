import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A short shake when something is refused — a wrong password, an invalid code.
 *
 * IT IS NEVER THE ONLY SIGNAL. The shake is a nudge towards the message; the
 * message is the feedback. A field that only wobbles has told nobody what is
 * wrong, and told a screen reader nothing at all — which is why this takes the
 * error text as a prop and renders it in a live region rather than leaving that
 * to the caller.
 *
 * It RE-FIRES on a repeated failure, keyed by a counter rather than a boolean.
 * Two wrong passwords in a row leave the flag `true` both times, so the CSS
 * animation never restarts and the second attempt gets no feedback at all —
 * which is exactly when it is most needed.
 *
 * It is a small horizontal translation and nothing else — no scale, no colour
 * flash. Under `prefers-reduced-motion` it does not move, and the message and
 * the border still change.
 */
export function ShakeError({ shakeKey, error, children, className }: {
  shakeKey: number;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="shake-error" className={cn("flex flex-col gap-1.5", className)}>
      <div
        // Keyed on the counter, so a second failure restarts the animation.
        key={shakeKey}
        className={cn(shakeKey > 0 && "motion-safe:animate-[shake_320ms_ease-in-out]")}
      >
        {children}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium">{error}</p>
      ) : null}
      <style>{`@keyframes shake {
        0%, 100% { transform: translateX(0) }
        20% { transform: translateX(-5px) }
        40% { transform: translateX(5px) }
        60% { transform: translateX(-3px) }
        80% { transform: translateX(3px) }
      }`}</style>
    </div>
  );
}
