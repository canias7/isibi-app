import { cn } from "@/lib/utils";
/**
 * What it costs to pay the whole thing off today.
 *
 * THE FIGURE HAS A DATE AND THE COMPONENT NEVER LETS IT LOSE ONE. A redemption
 * amount is correct for one day; interest accrues after it, and a figure quoted
 * without its date gets used a fortnight later and leaves the account open with
 * a small balance nobody expected.
 *
 * THE EARLY-REPAYMENT CHARGE IS BROKEN OUT AND SO IS WHEN IT STOPS. It is
 * frequently the largest part of the figure and it usually falls away on a known
 * date — waiting six weeks can be worth thousands, and nothing in a single total
 * shows that.
 *
 * THE TOTAL IS SUMMED FROM ITS PARTS. A redemption statement whose total does not
 * equal its own breakdown is the thing borrowers and lenders argue about, and
 * here it cannot happen.
 *
 * NO ADVICE ON WHETHER TO REDEEM. The component states the cost and the date the
 * charge ends, which is what the decision needs, and stops there.
 */
export function RedemptionNote({ balance, interestToDate, earlyRepaymentCharge, chargeEndsOn, fees = [], validOn, currency = "GBP", locale = "en-GB", className }: {
  balance: number;
  interestToDate?: number;
  /** Often the largest part, and usually time-limited. */
  earlyRepaymentCharge?: number;
  chargeEndsOn?: string;
  fees?: { id: string; what: string; amount: number }[];
  /** The one day this figure is right for. */
  validOn?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  // Summed, never supplied: a total that disagrees with its own breakdown is the
  // thing a redemption statement gets argued about for.
  const parts = [
    { id: "balance", what: "Balance outstanding", amount: balance },
    ...(interestToDate !== undefined ? [{ id: "interest", what: "Interest to this date", amount: interestToDate }] : []),
    ...(earlyRepaymentCharge !== undefined
      ? [{ id: "erc", what: "Early repayment charge", amount: earlyRepaymentCharge }]
      : []),
    ...fees,
  ];
  const total = parts.reduce((n, p) => n + p.amount, 0);
  // One precision for the whole COLUMN, decided by whether anything in it has
  // pence. Per-value rounding puts £241,300 above £412.88 and the decimal points
  // stop lining up, which is the one thing a breakdown has to do.
  const anyPence = [...parts.map((p) => p.amount), total].some((v) => !Number.isInteger(v));
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: anyPence ? 2 : 0,
      maximumFractionDigits: anyPence ? 2 : 0,
    }).format(v);
  // A second formatter for prose, deliberately. What a column needs and what a
  // sentence needs are opposites: the column wants every figure to the same
  // precision so the points line up, and "the £7,239.00 charge" mid-sentence is
  // an amount wearing a column's clothes.
  const say = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  return (
    <div data-slot="redemption-note" className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{money(total)}</span>
        <span className="text-muted-foreground"> to clear it</span>
      </p>
      <p className={cn("text-xs", validOn ? "text-muted-foreground" : "font-medium")}>
        {validOn
          ? `Correct on ${validOn} only. Interest carries on after that, so a later payment leaves a small balance.`
          : "No date on this figure. A redemption amount is only right for one day."}
      </p>
      <dl className="space-y-0.5 text-xs tabular-nums text-muted-foreground">
        {parts.map((p) => (
          <div key={p.id} className="flex justify-between gap-4">
            <dt>{p.what}</dt>
            <dd>{money(p.amount)}</dd>
          </div>
        ))}
      </dl>
      {earlyRepaymentCharge !== undefined && chargeEndsOn && (
        <p className="text-xs font-medium tabular-nums">
          The {say(earlyRepaymentCharge)} charge stops applying after {chargeEndsOn}. Waiting until then costs
          nothing but time.
        </p>
      )}
    </div>
  );
}
