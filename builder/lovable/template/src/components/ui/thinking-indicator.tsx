import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The "working on it" state before any text arrives.
 *
 * After a while it says WHAT it is doing, and how long it has been. Three
 * bouncing dots for forty seconds is indistinguishable from a request that
 * died, and the reload that follows costs the answer that was nearly ready.
 * The elapsed time only appears past a threshold, so a fast reply never gets
 * decorated with a stopwatch.
 *
 * `prefers-reduced-motion` gets a static row of dots and the same text. The
 * animation carries nothing the words do not.
 *
 * ONE polite live region for the label, not for the timer. Announcing "12
 * seconds, 13 seconds" makes the page unusable with a screen reader, so the
 * seconds are `aria-hidden` and only the stage — "Searching the web" — is
 * spoken, when it changes.
 */
export function ThinkingIndicator({ label = "Thinking", startedAt, showTimeAfter = 5, className }: {
  label?: React.ReactNode;
  startedAt?: number;
  showTimeAfter?: number;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (startedAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const secs = startedAt == null ? 0 : Math.floor((now - startedAt) / 1000);
  const show = startedAt != null && secs >= showTimeAfter;

  return (
    <p data-slot="thinking-indicator" className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i}
            style={{ animationDelay: `${i * 160}ms` }}
            className="size-1.5 rounded-full bg-current motion-safe:animate-bounce" />
        ))}
      </span>
      <span aria-live="polite">{label}</span>
      {show ? <span aria-hidden className="tabular-nums">· {secs}s</span> : null}
    </p>
  );
}
