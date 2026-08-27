import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "3 new bookings — show them" floating over a list that has fresh data.
 *
 * NEW DATA NEVER INSERTS ITSELF INTO A LIST SOMEBODY IS READING. Rows arriving
 * at the top shove everything down mid-read, and acting on the wrong row after
 * a silent shift is how the expensive misclicks happen. The pill holds the new
 * items until asked — the same respect for reading position as
 * `transcript-view`, for data instead of scroll.
 *
 * IT COUNTS AND NAMES what is waiting. "3 new bookings" is a decision;
 * "new data available" is a mystery box.
 *
 * At the TOP of the list it can apply immediately instead of showing — nothing
 * shifts under a reader who is already at the newest end. The caller passes
 * `atTop`; only it knows the scroll container.
 *
 * `aria-live="polite"` — the arrival is exactly what somebody not watching
 * needs to hear once.
 */
export function RefreshPill({ count, noun = "item", onShow, atTop, className }: {
  count: number;
  noun?: string;
  onShow: () => void;
  atTop?: boolean;
  className?: string;
}) {
  // Already at the newest end: apply without asking, nothing shifts under anyone.
  const showRef = React.useRef(onShow);
  showRef.current = onShow;
  React.useEffect(() => {
    if (atTop && count > 0) showRef.current();
  }, [atTop, count]);

  if (count === 0 || atTop) return null;
  return (
    <div data-slot="refresh-pill" aria-live="polite" className={cn("pointer-events-none sticky top-2 z-20 flex justify-center", className)}>
      <button type="button" onClick={onShow}
        className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-md hover:opacity-90">
        <ArrowUp aria-hidden className="size-3" />
        {count.toLocaleString()} new {count === 1 ? noun : `${noun}s`} — show {count === 1 ? "it" : "them"}
      </button>
    </div>
  );
}
