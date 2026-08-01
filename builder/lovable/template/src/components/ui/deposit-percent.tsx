import { cn } from "@/lib/utils";
/**
 * How much is being put down — and how close the next threshold is.
 *
 * THE DISTANCE TO THE NEXT BAND IS THE WHOLE POINT. Lenders price in steps, so a
 * deposit at 9.4% and one at 10% are priced very differently while looking almost
 * identical, and the borrower is often a few hundred away from a materially
 * cheaper rate without knowing. The component computes exactly how much more is
 * needed.
 *
 * THE BANDS ARE THE CALLER'S, NOT OURS. Where the steps fall differs by lender
 * and by country; the component holds the shape and the caller supplies the
 * numbers.
 *
 * IT SHOWS THE PERCENTAGE AND THE AMOUNT TOGETHER. People save an amount and
 * lenders price a percentage, and the translation between them is a sum nobody
 * does in their head at the moment they need it.
 *
 * ROUNDS DOWN, ALWAYS. A deposit shown as 10% when it is 9.97% is the one
 * rounding error here that costs somebody a rate they were told they had.
 */
export function DepositPercent({ deposit, price, bands = [5, 10, 15, 20, 25, 40], currency = "GBP", locale = "en-GB", className }: {
  deposit: number;
  price: number;
  /** Where the lender's steps fall. */
  bands?: number[];
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  // Rounded DOWN: showing 10% for 9.97% hands somebody a band they do not have.
  const raw = price > 0 ? (deposit / price) * 100 : 0;
  const pct = Math.floor(raw * 10) / 10;
  const next = bands.filter((b) => b > raw).sort((a, b) => a - b)[0];
  const needed = next !== undefined ? Math.ceil((next / 100) * price - deposit) : undefined;
  const reached = [...bands].sort((a, b) => b - a).find((b) => raw >= b);
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{pct}%</span>
        <span className="text-muted-foreground">
          {" "}
          · {money(deposit)} of {money(price)}
        </span>
      </p>
      {reached !== undefined ? (
        <p className="text-xs tabular-nums text-muted-foreground">Past the {reached}% mark.</p>
      ) : (
        <p className="text-xs tabular-nums">
          Below the smallest band most lenders price to ({Math.min(...bands)}%).
        </p>
      )}
      {next !== undefined && needed !== undefined && needed > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {money(needed)} more takes you to {next}%, which is usually a step down in rate rather than a small one.
        </p>
      )}
    </div>
  );
}
