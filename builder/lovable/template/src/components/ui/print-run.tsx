import { cn } from "@/lib/utils";
/**
 * How many to print — with what unsold copies cost.
 *
 * OVERPRINTING AND UNDERPRINTING COST DIFFERENT AMOUNTS AND THE COMPONENT SHOWS
 * BOTH. Unsold copies are pulped at a known cost per copy; a sell-out is lost
 * revenue at a much higher one. The decision is asymmetric and almost nobody
 * writes the two numbers down beside each other.
 *
 * THE MARGINAL COST PER COPY FALLS AND THE FIRST COPY IS ENORMOUS. Setup
 * dominates a short run, so 2,000 copies often costs barely more than 1,500 —
 * which is the single most useful fact when choosing a number.
 *
 * RETURNS ARE PART OF THE ARITHMETIC where the trade allows them. Printing to
 * demand is meaningless if half the distribution can send copies back, and the
 * expected return rate belongs in the same figure.
 *
 * THE TOTAL IS COMPUTED FROM SETUP AND MARGINAL COST, never supplied, so a
 * quote cannot disagree with its own components.
 */
export function PrintRun({ copies, setupCost, perCopyCost, pulpCostPerCopy, expectedSalesLow, expectedSalesHigh, returnRate, currency = "GBP", locale = "en-GB", className }: {
  copies: number;
  /** Fixed, whatever the run length. */
  setupCost?: number;
  /** Marginal, per copy. */
  perCopyCost?: number;
  /** What disposing of an unsold copy costs. */
  pulpCostPerCopy?: number;
  expectedSalesLow?: number;
  expectedSalesHigh?: number;
  /** Share sent back by the trade, 0–1. */
  returnRate?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  // Decided per value: a total of £10,560 wants no pence, but the marginal cost
  // per copy is 68p and rounding it to "£1" makes the most important number on
  // the screen wrong by nearly half.
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  // Computed, never supplied: a quote that disagrees with its own breakdown is
  // the thing a printer and a publisher argue about.
  const total = (setupCost ?? 0) + (perCopyCost ?? 0) * copies;
  const each = copies > 0 ? total / copies : 0;
  const overBy = expectedSalesHigh !== undefined ? copies - expectedSalesHigh : undefined;
  const shortBy = expectedSalesLow !== undefined ? expectedSalesLow - copies : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{copies.toLocaleString()} copies</span>
        {setupCost !== undefined && perCopyCost !== undefined && (
          <span className="text-muted-foreground"> · {money(total)}, {money(each)} each</span>
        )}
      </p>
      {setupCost !== undefined && perCopyCost !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(setupCost)} of that is setup, whatever you print — so a longer run is much cheaper per copy.
        </p>
      )}
      {(expectedSalesLow !== undefined || expectedSalesHigh !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Expecting to sell {expectedSalesLow?.toLocaleString()}–{expectedSalesHigh?.toLocaleString()}
          {returnRate !== undefined && ` before returns, which run at about ${Math.round(returnRate * 100)}%`}.
        </p>
      )}
      {overBy !== undefined && overBy > 0 && pulpCostPerCopy !== undefined && (
        <p className="text-xs tabular-nums">
          If it sells at the top of that, {overBy.toLocaleString()} copies are left — about {money(overBy * pulpCostPerCopy)} to pulp.
        </p>
      )}
      {shortBy !== undefined && shortBy > 0 && (
        <p className="text-xs font-medium tabular-nums">
          If it sells at the bottom of that you are still {shortBy.toLocaleString()} short — a reprint costs the setup again.
        </p>
      )}
    </div>
  );
}
