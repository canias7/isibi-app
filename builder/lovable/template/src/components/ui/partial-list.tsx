import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A list that loaded — except for some of it.
 *
 * PARTIAL SUCCESS IS ITS OWN STATE, and the commonest one nobody designs for:
 * three of four sources answered, one timed out. Rendering the 30 rows that
 * arrived as if they were everything is a silent lie about completeness;
 * rendering the error state throws away 30 good rows. This shows both.
 *
 * THE NOTICE NAMES WHAT IS MISSING — "bookings from before June", "the
 * archive" — because "some items could not be loaded" gives no way to judge
 * whether the missing part matters to the task at hand.
 *
 * IT SITS AT THE POSITION OF THE GAP when the gap has one (end of the loaded
 * range), not in a banner at the top. A notice above 30 complete-looking rows
 * gets scrolled past; a row-shaped notice where the missing rows would be is
 * in the reader's path.
 *
 * Retry retries THE MISSING PART, and the loaded rows do not reload — the
 * same section-not-page rule as `load-error`.
 */
export function PartialList({ children, missing, onRetryMissing, retrying, className }: {
  children: React.ReactNode;
  missing: React.ReactNode;
  onRetryMissing?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="partial-list" className={className}>
      {children}
      <div role="status"
        className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-foreground px-3 py-2.5 text-xs">
        <AlertCircle aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="font-medium">Some of this is missing:</strong> {missing}
        </span>
        {onRetryMissing ? (
          <button type="button" onClick={onRetryMissing} disabled={retrying}
            className="shrink-0 cursor-pointer font-medium underline underline-offset-2 disabled:pointer-events-none disabled:opacity-60">
            {retrying ? "Trying…" : "Load the rest"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
