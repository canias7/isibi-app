import { cn } from "@/lib/utils";
/**
 * An asset being written down — with what is left, and how long.
 *
 * NET BOOK VALUE IS THE HEADLINE, not the original cost. What the asset is
 * worth on the books today is what every decision uses — an insurance value, a
 * disposal, an impairment — and cost alone is a historical fact of no
 * operational use.
 *
 * A FULLY DEPRECIATED ASSET STILL IN USE IS FLAGGED. It sits at nil or a
 * residual value while doing real work, which distorts both the balance sheet
 * and any return-on-assets figure, and it is the most common state of a fixed
 * asset register nobody maintains.
 *
 * THE METHOD IS SHOWN because straight-line and reducing-balance give
 * dramatically different values in the early years, and a register mixing them
 * without saying so cannot be checked.
 *
 * REMAINING LIFE IS IN PERIODS, not a percentage. "7 months left" schedules a
 * replacement; "63% depreciated" does not.
 */
export function DepreciationRow({ asset, cost, accumulated, method = "straight-line", monthsRemaining, residual = 0, stillInUse, currency = "GBP", locale = "en-GB", className }: {
  asset: string;
  cost: number;
  /** Depreciation charged to date. */
  accumulated: number;
  method?: "straight-line" | "reducing-balance";
  monthsRemaining?: number;
  /** What it is expected to be worth at the end. */
  residual?: number;
  stillInUse?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const nbv = Number((cost - accumulated).toFixed(2));
  const fullyDepreciated = nbv <= residual;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{asset}</span>
        <span className="shrink-0 tabular-nums">{money(nbv)}</span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {money(cost)} cost · {money(accumulated)} written off so far · {method === "straight-line" ? "straight line" : "reducing balance"}
      </p>
      {monthsRemaining !== undefined && !fullyDepreciated && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {monthsRemaining} {monthsRemaining === 1 ? "month" : "months"} of life left.
        </p>
      )}
      {fullyDepreciated && (
        <p className="text-xs font-medium">
          {stillInUse
            ? "Fully written down and still in use — the books say this is worth nothing."
            : "Fully written down."}
        </p>
      )}
    </li>
  );
}
