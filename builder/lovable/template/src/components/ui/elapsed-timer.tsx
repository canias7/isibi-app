import * as React from "react";
import { cn, isoAttr, toDate } from "@/lib/utils";
/**
 * "Started 14:02 · 23 min" — elapsed time that cannot drift.
 *
 * COMPUTED FROM THE START TIMESTAMP EVERY TICK, never accumulated. An
 * accumulator (+1 per interval) undercounts in throttled background tabs
 * — the idle-note lesson — and a timer that says 8 minutes after a
 * 25-minute lunch is worse than none. Subtracting from `since` is
 * immune: the tab can sleep all it likes, the arithmetic lands right on
 * wake.
 *
 * MINUTE GRANULARITY, minute tick. Seconds on an elapsed-work display
 * are noise that costs a re-render each; anything needing seconds is a
 * stopwatch, which is the next component over.
 *
 * Both facts shown: when it started (anchor) and how long that is
 * (arithmetic) — either alone makes the reader do the other half.
 */
export function ElapsedTimer({ since, prefix = "Started", className }: {
  since: Date | string | number;
  prefix?: React.ReactNode;
  className?: string;
}) {
  const start = React.useMemo(() => toDate(since), [since]);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 6e4));
  const words = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 text-sm", className)}>
      <span className="text-xs text-muted-foreground">
        {prefix} <time dateTime={isoAttr(start)}>{start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
      </span>
      <span className="font-medium tabular-nums">{words}</span>
    </span>
  );
}
