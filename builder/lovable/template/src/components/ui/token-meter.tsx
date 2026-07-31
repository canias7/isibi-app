import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * How much of an allowance has been spent.
 *
 * It says what happens AT the limit, not just where the limit is. "18,400 of
 * 20,000" leaves somebody to guess whether hitting it stops the work, charges
 * them, or queues it — three very different things to plan around, and the
 * whole reason to look at this number.
 *
 * It is QUIET until it matters. Below the threshold it is one small line; past
 * it, it gets a bar and a sentence. A prominent meter on every screen trains
 * people to ignore the one moment it is worth reading.
 *
 * Numbers are grouped by locale and use tabular figures, because this changes
 * as you watch and unequal digit widths make it jitter sideways.
 *
 * `resets` is spelled as a date, never "in 4 days". A relative time computed on
 * a page that stays open all week goes stale silently, and "resets on 1 August"
 * is what somebody needs to plan around anyway.
 */
export function TokenMeter({
  used, limit, unit = "tokens", atLimit, resets, warnAt = 0.75, className,
}: {
  used: number;
  limit: number;
  unit?: string;
  atLimit?: React.ReactNode;
  resets?: React.ReactNode;
  warnAt?: number;
  className?: string;
}) {
  const frac = limit > 0 ? Math.min(1, used / limit) : 0;
  const loud = frac >= warnAt;

  if (!loud) {
    return (
      <p className={cn("text-xs text-muted-foreground tabular-nums", className)}>
        {used.toLocaleString()} of {limit.toLocaleString()} {unit}
        {resets ? <span> · resets {resets}</span> : null}
      </p>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-md border border-border p-2.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums">
          {used.toLocaleString()} of {limit.toLocaleString()} {unit}
        </span>
        <span className="text-muted-foreground tabular-nums">{Math.round(frac * 100)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div aria-hidden className="h-full rounded-full bg-foreground" style={{ width: `${frac * 100}%` }} />
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {frac >= 1
          ? (atLimit ?? "You have used the whole allowance.")
          : <>Nearly used up. {atLimit ?? null}</>}
        {resets ? <> Resets {resets}.</> : null}
      </p>
    </div>
  );
}
