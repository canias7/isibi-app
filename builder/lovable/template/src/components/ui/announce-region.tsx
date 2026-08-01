import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A live region that actually announces.
 *
 * THE REGION MUST EXIST BEFORE THE MESSAGE DOES. A live region rendered at the
 * same moment as its first message is usually not announced at all — screen
 * readers watch existing regions for changes, and one that appears already
 * populated is just new content. So this always renders, empty.
 *
 * IT CLEARS AFTER A MOMENT, so the same message announced twice in a row is
 * heard twice. Setting identical text is not a change, and without the clear the
 * second "Saved" is silent — which is the bug that makes people think live
 * regions are unreliable.
 *
 * `polite` by default. `assertive` interrupts whatever is being read and is
 * correct only for something the reader must act on immediately.
 */
export function AnnounceRegion({ message, urgency = "polite", clearAfterMs = 3000, className }: {
  message?: string;
  urgency?: "polite" | "assertive";
  clearAfterMs?: number;
  className?: string;
}) {
  const [shown, setShown] = React.useState("");
  React.useEffect(() => {
    if (!message) { setShown(""); return; }
    // Clear first so an identical repeat still counts as a change.
    setShown("");
    const set = setTimeout(() => setShown(message), 50);
    const clear = setTimeout(() => setShown(""), clearAfterMs);
    return () => { clearTimeout(set); clearTimeout(clear); };
  }, [message, clearAfterMs]);
  return (
    <p role="status" aria-live={urgency} aria-atomic="true" className={cn("sr-only", className)}>
      {shown}
    </p>
  );
}
