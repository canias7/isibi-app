import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Trying again in 8s", counting down for real.
 *
 * It owns the tick rather than making every caller run an interval — this is
 * the one component in the sync set that genuinely needs its own clock, and a
 * page with three retrying things should not have three timers to manage.
 *
 * THE INTERVAL IS CLEARED ON UNMOUNT AND WHENEVER `seconds` CHANGES. Without
 * that a caller who re-renders with a fresh delay stacks a second interval on
 * the first, and the number starts skipping — which reads as the retry being
 * broken rather than the timer.
 *
 * `onElapsed` fires once, guarded by a ref, because React may render the zero
 * state more than once and firing a retry twice is exactly the bug this whole
 * family of components exists to avoid.
 *
 * "Try now" is always available. Somebody who can see the connection is back
 * should never have to sit out a countdown.
 */
export function RetryCountdown({ seconds, onElapsed, onRetryNow, what, className }: {
  /** Seconds to count down from. Changing it restarts the clock. */
  seconds: number;
  onElapsed?: () => void;
  onRetryNow?: () => void;
  /** Names the thing being retried, for the accessible label. */
  what?: string;
  className?: string;
}) {
  const [left, setLeft] = React.useState(seconds);
  const fired = React.useRef(false);

  React.useEffect(() => {
    setLeft(seconds);
    fired.current = false;
    if (seconds <= 0) return;
    const id = setInterval(() => setLeft((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const elapsedRef = React.useRef(onElapsed);
  elapsedRef.current = onElapsed;
  React.useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; elapsedRef.current?.(); }
  }, [left]);

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <span role="status" className="tabular-nums">
        {left > 0 ? `Trying again in ${left}s` : "Trying again…"}
      </span>
      {onRetryNow && (
        <button type="button" onClick={onRetryNow}
          aria-label={what ? `Retry ${what} now` : "Retry now"}
          className="cursor-pointer underline underline-offset-2">Try now</button>
      )}
    </span>
  );
}
