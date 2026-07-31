import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * What this actually cost over time — the honest version of "was £80".
 *
 * A "WAS" PRICE NOBODY EVER PAID IS THE CLASSIC FAKE DISCOUNT, and in much
 * of the world it is now illegal: the reference must be the lowest price in
 * a recent window. This computes that from the real history rather than
 * accepting a `wasPrice` prop, which is the entire point — there is no way
 * to pass it a number that did not happen.
 *
 * IT PRINTS THE WINDOW ("lowest in the last 30 days"), because a saving
 * without its baseline is not checkable.
 *
 * THE REFERENCE EXCLUDES TODAY'S PRICE, which is both the law and the only
 * way the comparison means anything. A first cut pooled every point
 * including the current one, so `lowest <= current` always held, the saving
 * branch was unreachable, and the component could only ever say "not cheaper
 * than it has recently been" — a dead branch that typechecked and rendered
 * plausibly. Caught by looking at two worked examples side by side.
 *
 * NO CHART. Half a dozen prices is a sentence, not a graph, and charts are
 * another session's job in this kit.
 */
export function PriceHistory({ points, currency = "GBP", windowDays = 30, className }: {
  points: { on: string; priceMinor: number }[];
  currency?: string;
  windowDays?: number;
  className?: string;
}) {
  if (!points.length) return null;
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);
  const current = points[points.length - 1].priceMinor;
  const cutoff = Date.now() - windowDays * 864e5;
  // Prior prices only: today's price cannot be its own reference.
  const prior = points.slice(0, -1).filter((p) => new Date(p.on).getTime() >= cutoff);
  const lowestPrior = prior.length ? Math.min(...prior.map((p) => p.priceMinor)) : null;
  const saving = lowestPrior != null && current < lowestPrior ? lowestPrior - current : 0;

  return (
    <div className={cn("flex flex-col gap-0.5 text-xs", className)}>
      <p className="tabular-nums">
        <b>{fmt(current)}</b> now
        {lowestPrior != null
          ? <> · lowest in the {windowDays} days before was <b>{fmt(lowestPrior)}</b></>
          : <> · no earlier price in the last {windowDays} days</>}
      </p>
      {lowestPrior == null ? null : saving > 0 ? (
        <p className="tabular-nums text-muted-foreground">That is {fmt(saving)} below the recent low.</p>
      ) : (
        <p className="text-muted-foreground">Not cheaper than it has recently been.</p>
      )}
    </div>
  );
}
