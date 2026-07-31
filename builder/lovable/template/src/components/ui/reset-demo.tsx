import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Start the demo over" — a scoped wipe for sandboxes.
 *
 * IT CLEARS EXACTLY THE KEYS IT WAS GIVEN, and lists what that means in
 * plain words before doing it. A demo reset that reaches for
 * `localStorage.clear()` takes the person's real preferences, their saved
 * drafts and every other feature's state with it — scoping to named keys
 * is the entire difference between "reset the demo" and "reset me".
 *
 * CONFIRMED INLINE WITH NO FOCUSED (the reset-defaults pattern — same
 * component family, different blast radius, same discipline), and it says
 * it happened, because a wipe with no acknowledgement looks like a
 * broken button.
 *
 * `onReset` runs AFTER the keys clear, for callers that also hold state
 * in memory — clearing storage under live React state changes nothing on
 * screen until told.
 */
export function ResetDemo({ keys, clears, onReset, className }: {
  keys: string[];
  /** Plain words for what goes: "the sample bookings and your tour progress" */
  clears: React.ReactNode;
  onReset?: () => void;
  className?: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const noRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { if (confirming) noRef.current?.focus(); }, [confirming]);

  if (done) return <p className={cn("text-sm text-muted-foreground", className)}>Fresh start — the demo is back to the beginning.</p>;
  if (confirming) {
    return (
      <div className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
        <p className="text-sm">Start over? This clears {clears}.</p>
        <div className="flex gap-2">
          <button ref={noRef} type="button" onClick={() => setConfirming(false)}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium">
            Keep going
          </button>
          <button type="button"
            onClick={() => {
              for (const k of keys) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
              onReset?.();
              setDone(true);
            }}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm">
            Start over
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)}
      className={cn("cursor-pointer self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted", className)}>
      Start the demo over
    </button>
  );
}
