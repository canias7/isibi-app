import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "8 of 10 free exports used this month" — the warning BEFORE the wall.
 *
 * IT APPEARS AT A THRESHOLD (default 80%), because the version that only
 * speaks at 100% is not a warning, it is the refusal itself with a
 * moment's notice. The tolerance-bar rule applied to quotas: the useful
 * information is distance-to-limit while there is still distance.
 *
 * COUNTS, NOT A BARE PERCENT — "8 of 10" says how many are LEFT, which is
 * the decision-relevant number; "80%" makes the reader do arithmetic on
 * an unstated denominator.
 *
 * DISMISS LASTS THE PERIOD, per quota (localStorage key carries the
 * period label) — a nudge that returns on every page load trains
 * dismissal; one that never returns misses next month. At 100% it shows
 * regardless of dismissal, because "you are at the limit" is not a nudge
 * any more, it is the state of the world.
 */
export function UsageNudge({ used, limit, what, period = "this month", threshold = 0.8, onUpgrade, className }: {
  used: number;
  limit: number;
  what: string;
  period?: string;
  threshold?: number;
  onUpgrade?: () => void;
  className?: string;
}) {
  const key = `usage-nudge-${what}-${period}`.replace(/\s+/g, "-");
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    try { setDismissed(localStorage.getItem(key) === "1"); } catch { /* private mode */ }
  }, [key]);

  const full = used >= limit;
  const show = full || (used / limit >= threshold && !dismissed);
  if (!show) return null;
  return (
    <div role="status" className={cn(
      "motion-enter flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm",
      full && "border-foreground", className)}>
      <span>
        {full
          ? <>All {limit} {what} used {period}.</>
          : <><b className="tabular-nums">{used} of {limit}</b> {what} used {period} — {limit - used} left.</>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {onUpgrade ? (
          <button type="button" onClick={onUpgrade}
            className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
            Get more
          </button>
        ) : null}
        {!full ? (
          <button type="button" aria-label="Dismiss until next period"
            onClick={() => { setDismissed(true); try { localStorage.setItem(key, "1"); } catch { /* best effort */ } }}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Later
          </button>
        ) : null}
      </span>
    </div>
  );
}
