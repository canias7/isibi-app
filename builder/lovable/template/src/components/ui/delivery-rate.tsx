import { cn } from "@/lib/utils";
/**
 * How much is getting through, over a stated window.
 *
 * FIRST-ATTEMPT SUCCESS IS SEPARATED FROM EVENTUAL SUCCESS. An endpoint
 * delivering 99% eventually but only 40% first time is failing constantly and
 * being rescued by retries — which is invisible in a single success figure and
 * is exactly the state that turns into an auto-disable next week.
 *
 * THE WINDOW IS ALWAYS NAMED. "98% delivered" over an hour and over a quarter
 * are different claims, and a percentage with no period attached is the
 * standard way a dashboard flatters itself.
 *
 * A SMALL SAMPLE SAYS SO. Three events, two delivered, is not 67% — it is not
 * enough to say anything, and the same warning `response-rate` gives applies
 * for the same reason.
 *
 * NUMBERS AND WORDS, no chart. A sparkline of delivery rate is decoration; the
 * two percentages and the failure count are what somebody acts on.
 */
export function DeliveryRate({ delivered, total, firstAttempt, window: period, smallBelow = 20, className }: {
  delivered: number;
  total: number;
  /** How many succeeded without a retry. */
  firstAttempt?: number;
  /** Free text — "the last 24 hours". */
  window?: string;
  /** Below this many events, the sample is called small. */
  smallBelow?: number;
  className?: string;
}) {
  if (total <= 0) {
    return <p data-slot="delivery-rate" className={cn("text-sm text-muted-foreground", className)}>No events{period ? ` in ${period}` : ""}.</p>;
  }
  const pct = Math.round((delivered / total) * 100);
  const firstPct = firstAttempt !== undefined ? Math.round((firstAttempt / total) * 100) : null;
  const failed = total - delivered;
  const small = total < smallBelow;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium tabular-nums">{pct}%</span>
        <span className="text-muted-foreground"> delivered{period ? ` in ${period}` : ""}</span>
        <span className="text-muted-foreground tabular-nums"> · {delivered.toLocaleString()} of {total.toLocaleString()}</span>
      </p>
      {firstPct !== null && (
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums text-foreground">{firstPct}%</span> got through on the first try
          {firstPct < pct - 5 && <span> — the rest needed a retry.</span>}
        </p>
      )}
      {failed > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">{failed.toLocaleString()} not delivered</p>
      )}
      {small && (
        <p className="text-xs text-muted-foreground">Too few events to read much into this.</p>
      )}
    </div>
  );
}
