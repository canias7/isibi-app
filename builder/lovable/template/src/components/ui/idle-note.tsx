import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "You were away a while — this may be out of date."
 *
 * A TIMESTAMP COMPARED ON RETURN, NEVER A TICKING TIMER. Background tabs
 * get their timers throttled to nothing, so an interval that counts the
 * absence undercounts it in exactly the tab this exists for. The moment
 * of hiding is stamped; visibilitychange back computes the real gap from
 * the clock.
 *
 * IT APPEARS ONLY PAST THE THRESHOLD (default 10 min) — a note after a
 * 40-second tab-switch trains people to dismiss it forever. And it offers
 * REFRESH rather than doing it: the person may be mid-form, and stale-but-
 * mine beats fresh-but-gone (the refresh-pill rule, for time instead of
 * data).
 *
 * Renders nothing until then; dismiss is per-absence, not permanent.
 */
export function IdleNote({ minutes = 10, onRefresh, className }: {
  minutes?: number;
  onRefresh?: () => void;
  className?: string;
}) {
  const [away, setAway] = React.useState<number | null>(null);
  const hiddenAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current != null) {
        const gone = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (gone >= minutes * 60_000) setAway(Math.round(gone / 60_000));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [minutes]);

  if (away == null) return null;
  return (
    <div role="status" className={cn(
      "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm",
      className)}>
      <span>
        You were away about {away} minute{away === 1 ? "" : "s"} — what is on screen may be out of date.
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {onRefresh ? (
          <button type="button" onClick={() => { setAway(null); onRefresh(); }}
            className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
            Refresh
          </button>
        ) : null}
        <button type="button" onClick={() => setAway(null)} aria-label="Dismiss"
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
          It's fine
        </button>
      </span>
    </div>
  );
}
