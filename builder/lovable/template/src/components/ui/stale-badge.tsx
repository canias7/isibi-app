import * as React from "react";
import { cn, toDate } from "@/lib/utils";
/**
 * "As of 11:40" — data that is being shown from an earlier fetch.
 *
 * STALENESS IS RELATIVE TO THE DATA'S CADENCE, not the clock. Five-minute-old
 * analytics are fresh; a five-minute-old seat map is not. `staleAfter` is the
 * caller's claim about cadence, and below it the badge shows nothing at all —
 * a timestamp on every widget is noise that buries the one that matters.
 *
 * IT NEVER SAYS "LIVE". The moment it renders, the data is already however old
 * the network made it; "as of" a time is a checkable claim, "live" is a hope.
 *
 * The time is absolute in the title and `<time datetime>`, relative on screen
 * — same as everywhere else in the kit — and it re-renders each minute so
 * "2 min ago" does not sit there aging silently.
 */
export function StaleBadge({ asOf, staleAfter = 300, onRefresh, className }: {
  asOf: Date | number;
  staleAfter?: number;
  onRefresh?: () => void;
  className?: string;
}) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const at = typeof asOf === "number" ? asOf : asOf.getTime();
  const age = Math.max(0, (Date.now() - at) / 1000);
  if (age < staleAfter) return null;

  const mins = Math.round(age / 60);
  const label = mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  const iso = toDate(at).toISOString();

  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      as of <time dateTime={iso} title={toDate(at).toLocaleString()}>{label}</time>
      {onRefresh ? (
        <button type="button" onClick={onRefresh}
          className="cursor-pointer underline underline-offset-2 hover:text-foreground">refresh</button>
      ) : null}
    </span>
  );
}
