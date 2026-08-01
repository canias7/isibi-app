import { cn } from "@/lib/utils";
/**
 * How much extra can be paid — and what it saves.
 *
 * WHAT AN OVERPAYMENT SAVES IS SHOWN, IN YEARS AND IN MONEY. Nobody overpays for
 * the pleasure of a smaller balance; they do it to finish sooner and pay less
 * interest, and neither number appears anywhere on a normal statement. Without
 * them the allowance is a limit on something with no visible benefit.
 *
 * THE REMAINING ALLOWANCE IS COMPUTED FROM WHAT HAS ALREADY BEEN PAID, in the
 * period the allowance actually runs over — which is usually not the calendar
 * year everybody assumes.
 *
 * GOING OVER THE ALLOWANCE IS A CHARGE, NOT A REFUSAL, and the component says
 * so. People assume the extra payment will be rejected; it is normally accepted
 * with a fee, and knowing which changes what they do.
 *
 * NO ADVICE ABOUT WHETHER TO. Whether overpaying beats saving the money depends
 * on rates, on other debts and on how much slack somebody needs, and none of
 * that is knowable here.
 */
export function OverpaymentAllowance({ allowance, usedSoFar, periodEnds, chargePercent, balance, annualRatePercent, monthsSaved, interestSaved, currency = "GBP", locale = "en-GB", className }: {
  /** The allowance for the current period. */
  allowance: number;
  usedSoFar?: number;
  /** When the allowance resets — often not the calendar year. */
  periodEnds?: string;
  /** What going over costs. */
  chargePercent?: number;
  balance?: number;
  annualRatePercent?: number;
  /** What the overpayments made so far are worth. */
  monthsSaved?: number;
  interestSaved?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const used = usedSoFar ?? 0;
  const left = Math.max(0, allowance - used);
  const pct = allowance > 0 ? Math.min(100, (used / allowance) * 100) : 0;
  const years = monthsSaved !== undefined ? Math.floor(monthsSaved / 12) : undefined;
  const months = monthsSaved !== undefined ? monthsSaved % 12 : undefined;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{money(left)} left to overpay</span>
        <span className="text-muted-foreground">
          {" "}
          · {money(used)} of {money(allowance)} used{periodEnds ? `, resets ${periodEnds}` : ""}
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      {monthsSaved !== undefined && (
        <p className="text-xs tabular-nums">
          What you have already overpaid takes{" "}
          {years ? `${years} ${years === 1 ? "year" : "years"}` : ""}
          {years && months ? " and " : ""}
          {months ? `${months} ${months === 1 ? "month" : "months"}` : ""}
          {!years && !months ? "no time yet" : ""} off the end
          {interestSaved !== undefined ? `, and saves ${money(interestSaved)} in interest` : ""}.
        </p>
      )}
      {chargePercent !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          You can pay more than the allowance. It is not refused — there is a charge of {chargePercent}% on the
          excess.
        </p>
      )}
      {balance !== undefined && annualRatePercent !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(balance)} outstanding at {annualRatePercent}%.
        </p>
      )}
    </div>
  );
}
