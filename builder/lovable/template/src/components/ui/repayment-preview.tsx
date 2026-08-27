import { cn } from "@/lib/utils";
/**
 * What the loan costs — with the total paid shown as loudly as the monthly.
 *
 * THE TOTAL PAID IS THE NUMBER NOBODY SHOWS AND EVERYBODY NEEDS. A comparison
 * made on the monthly payment alone always picks the longest term, because a
 * longer term always has a smaller payment and always costs more. Both numbers,
 * side by side, is the entire component.
 *
 * INTEREST IS SHOWN AS AN AMOUNT, NOT ONLY A RATE. "5.4%" does not communicate;
 * "£71,000 of interest over the term" does, and it is the same fact.
 *
 * THE PAYMENT IS COMPUTED FROM THE PRINCIPAL, RATE AND TERM. A quoted payment
 * that disagrees with its own inputs is how a comparison table ends up
 * unfalsifiable, and here it cannot happen.
 *
 * INTEREST-ONLY IS A SEPARATE MODE, AND SAYS THE CAPITAL IS STILL OWED. Showing
 * a small monthly figure without that sentence is the single most misleading
 * thing a repayment table can do.
 */
export function RepaymentPreview({ principal, annualRatePercent, years, interestOnly, currency = "GBP", locale = "en-GB", className }: {
  principal: number;
  annualRatePercent: number;
  years: number;
  /** The capital is still owed at the end, and the component says so. */
  interestOnly?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const n = Math.max(1, Math.round(years * 12));
  const r = annualRatePercent / 100 / 12;
  // Computed, never quoted: a payment that disagrees with its own principal,
  // rate and term makes every comparison built on it unfalsifiable.
  const payment = interestOnly
    ? principal * r
    : r === 0
      ? principal / n
      : (principal * r) / (1 - Math.pow(1 + r, -n));
  const totalPaid = interestOnly ? payment * n + principal : payment * n;
  const interest = totalPaid - principal;
  return (
    <div data-slot="repayment-preview" className={cn("space-y-1 text-sm", className)}>
      <div className="flex flex-wrap gap-x-8 gap-y-1">
        <p className="tabular-nums">
          <span className="block text-xs text-muted-foreground">Each month</span>
          <span className="text-lg font-medium">{money(payment)}</span>
        </p>
        <p className="tabular-nums">
          <span className="block text-xs text-muted-foreground">Paid in total</span>
          <span className="text-lg font-medium">{money(totalPaid)}</span>
        </p>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {money(principal)} borrowed over {years} {years === 1 ? "year" : "years"} at {annualRatePercent}% —{" "}
        {money(interest)} of that is interest.
      </p>
      {interestOnly && (
        <p className="text-xs font-medium tabular-nums">
          Interest only. The {money(principal)} is still owed in full at the end, and nothing here is paying it off.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        A longer term always has a smaller monthly payment and always costs more in total.
      </p>
    </div>
  );
}
