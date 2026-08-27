import { cn } from "@/lib/utils";
/**
 * What is left after the payment — which is the only affordability question.
 *
 * IT LEADS WITH WHAT IS LEFT OVER, NOT WITH A RATIO. "You can borrow up to X" is
 * the number every lender shows and it answers the lender's question, not the
 * borrower's. Income minus commitments minus the payment is the figure somebody
 * lives on, and it is the one that decides whether this works.
 *
 * A STRESS FIGURE IS SHOWN BESIDE THE ACTUAL ONE. Rates move, and an affordable
 * payment at today's rate that is not affordable two points higher is the
 * position that ruins people. Showing both is the whole point.
 *
 * IT DOES NOT SAY YES OR NO. An approval is a decision made against a lender's
 * policy on evidence this component does not have, and a green tick here would
 * be read as one.
 *
 * NO CREDIT SCORE. It is not a number the borrower can act on, it differs
 * between agencies, and showing one invites optimising a proxy instead of the
 * thing it stands for.
 */
export function AffordabilityNote({ monthlyIncome, monthlyCommitments, monthlyPayment, stressedPayment, currency = "GBP", locale = "en-GB", className }: {
  /** Take-home, monthly. */
  monthlyIncome: number;
  /** Everything already committed. */
  monthlyCommitments?: number;
  monthlyPayment: number;
  /** The same loan at a higher rate. The number that matters. */
  stressedPayment?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const committed = monthlyCommitments ?? 0;
  const left = monthlyIncome - committed - monthlyPayment;
  const leftStressed =
    stressedPayment !== undefined ? monthlyIncome - committed - stressedPayment : undefined;
  // One precision for every figure here, decided by whether any of them has
  // pence. Deciding per value puts £620 above £1,485.50 in the same column and
  // the decimal points stop lining up.
  const anyPence = [monthlyIncome, committed, monthlyPayment, left, stressedPayment, leftStressed].some(
    (v) => v !== undefined && !Number.isInteger(v),
  );
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: anyPence ? 2 : 0,
      maximumFractionDigits: anyPence ? 2 : 0,
    }).format(v);
  return (
    <div data-slot="affordability-note" className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{money(left)}</span>
        <span className="text-muted-foreground"> left each month after this</span>
      </p>
      <dl className="space-y-0.5 text-xs tabular-nums text-muted-foreground">
        <div className="flex justify-between gap-4">
          <dt>Coming in</dt>
          <dd>{money(monthlyIncome)}</dd>
        </div>
        {monthlyCommitments !== undefined && (
          <div className="flex justify-between gap-4">
            <dt>Already committed</dt>
            <dd>−{money(committed)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt>This payment</dt>
          <dd>−{money(monthlyPayment)}</dd>
        </div>
      </dl>
      {leftStressed !== undefined && (
        <p className={cn("text-xs tabular-nums", leftStressed < 0 ? "font-medium" : "")}>
          If rates rise, the payment is {money(stressedPayment as number)} and you are left with{" "}
          {money(leftStressed)}
          {leftStressed < 0 ? " — that is less than nothing." : "."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        This is arithmetic, not a decision. Whether anybody will lend it is a separate question.
      </p>
    </div>
  );
}
