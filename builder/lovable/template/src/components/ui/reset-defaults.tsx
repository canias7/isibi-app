import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Reset to defaults — scoped, confirmed, and honest about what it spares.
 *
 * IT NAMES WHAT IT RESETS AND WHAT IT DOES NOT TOUCH. "Reset to defaults"
 * with no scope is read two opposite ways at once — "my colour scheme" and
 * "my customer records" — and the person who fears the second never clicks
 * it, while the person who assumed the first is furious when it was more.
 * `keeps` prints the not-touched list, because that is the fear.
 *
 * CONFIRMED INLINE, NO gets focus (the confirm-inline rule) — reset is not
 * undoable, the button sits in settings where people wander, and focus
 * landing on "Keep my settings" means Enter-mashing is safe.
 *
 * Afterwards it SAYS it happened. A reset that changes twelve invisible
 * values with no acknowledgement looks like a broken button.
 */
export function ResetDefaults({ what = "these settings", keeps, onReset, className }: {
  what?: string;
  keeps?: string[];
  onReset: () => void;
  className?: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const noRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => { if (confirming) noRef.current?.focus(); }, [confirming]);

  if (done) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Back to the defaults.</p>;
  }
  if (confirming) {
    return (
      <div className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
        <p className="text-sm">Put {what} back to the defaults?</p>
        {keeps?.length ? (
          <p className="text-xs text-muted-foreground">Not touched: {keeps.join(", ")}.</p>
        ) : null}
        <div className="flex gap-2">
          {/* No gets focus - Enter-mashing must land on the safe answer. */}
          <button ref={noRef} type="button" onClick={() => setConfirming(false)}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium">
            Keep my settings
          </button>
          <button type="button" onClick={() => { onReset(); setDone(true); }}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm">
            Reset
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)}
      className={cn("cursor-pointer self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted", className)}>
      Reset {what} to defaults
    </button>
  );
}
