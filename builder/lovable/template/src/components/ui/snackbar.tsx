import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * One message at the bottom of the screen, with one action.
 *
 * It is a SINGLETON, unlike `toast-stack`: the next message replaces this one
 * rather than stacking. That is the right shape for a per-action confirmation —
 * "Booking cancelled — Undo" — where only the most recent one is actionable and
 * a pile of them is just a pile.
 *
 * On a phone it sits ABOVE the safe area, using `env(safe-area-inset-bottom)`.
 * Without it, a snackbar on an iPhone is partly behind the home indicator and
 * the action is the part that is covered.
 *
 * It does NOT block anything underneath. A message about something that already
 * happened must not stop the next thing being done — which is also why it is
 * bottom-centre rather than over the primary action.
 *
 * Same rules as `toast-stack` about timing: an action means it waits, hover and
 * focus pause it.
 */
export function Snackbar({ message, action, onDismiss, duration = 5000, className }: {
  message: React.ReactNode;
  action?: { label: string; onAction: () => void };
  onDismiss?: () => void;
  duration?: number;
  className?: string;
}) {
  const [paused, setPaused] = React.useState(false);
  // Out of the deps: an inline `onDismiss` restarted the auto-dismiss
  // timeout on every parent render, so the snackbar never went away.
  const dismissRef = React.useRef(onDismiss);
  dismissRef.current = onDismiss;
  const ms = action ? 0 : duration;

  React.useEffect(() => {
    if (!ms || paused || !onDismiss) return;
    const t = setTimeout(() => dismissRef.current?.(), ms);
    return () => clearTimeout(t);
  }, [ms, paused, message]);

  if (!message) return null;
  return (
    <div data-slot="snackbar"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      className={cn("motion-fade fixed left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-lg bg-foreground px-4 py-2.5 text-background shadow-lg", className)}
    >
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      {action ? (
        <button type="button" onClick={action.onAction}
          className="shrink-0 cursor-pointer text-xs font-semibold underline underline-offset-2">
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss}
          className="shrink-0 cursor-pointer text-xs opacity-70 hover:opacity-100">
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
