import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * When this data last updated — against when it SHOULD.
 *
 * FRESHNESS IS RELATIVE TO A CADENCE, not to a feeling. "Updated 3 hours
 * ago" is fine for a daily feed and a crisis for a live one; with
 * `cadenceMs` stated, the component can say the only two things worth
 * saying: "updated 3h ago · refreshes daily" (on schedule) or "expected
 * an update 2h ago" (late, with the lateness computed, not adjectival).
 *
 * LATE IS WORDS + WEIGHT, never a red dot: "stale" as a colour tells you
 * nothing about HOW late, and how late is the decision-relevant part.
 *
 * Differs from stale-badge (a page's own data age, refresh in hand) —
 * this is about a FEED with a contract, where the reader usually cannot
 * refresh it, only distrust it correctly.
 */
export function DataFreshness({ updatedAt, cadenceMs, cadenceLabel, className }: {
  updatedAt: Date | string | number;
  cadenceMs: number;
  cadenceLabel: string;
  className?: string;
}) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const at = new Date(updatedAt);
  const age = Date.now() - at.getTime();
  const late = age > cadenceMs;
  const ago = (ms: number) => {
    if (ms >= 864e5) return `${Math.round(ms / 864e5)}d`;
    if (ms >= 36e5) return `${Math.round(ms / 36e5)}h`;
    return `${Math.max(1, Math.round(ms / 6e4))}m`;
  };

  return (
    <p className={cn("text-xs tabular-nums", late ? "font-medium" : "text-muted-foreground", className)}>
      {late
        ? <>Expected an update {ago(age - cadenceMs)} ago — last one <time dateTime={at.toISOString()}>{ago(age)} back</time>.</>
        : <>Updated <time dateTime={at.toISOString()}>{ago(age)} ago</time> · {cadenceLabel}</>}
    </p>
  );
}
