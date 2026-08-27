import { cn } from "@/lib/utils";
/**
 * Fixed or variable — described by what happens next, not by its name.
 *
 * THE END OF A FIXED PERIOD IS THE FACT PEOPLE MISS, and the component leads
 * with it. A two-year fix is a two-year decision followed by a payment shock,
 * and every layout that presents "2-year fixed, 4.2%" as the whole story leaves
 * the borrower to discover the second half themselves, two years later.
 *
 * WHAT IT REVERTS TO IS SHOWN AS A PAYMENT, not as a name. "Reverts to the
 * standard variable rate" means nothing; "the payment becomes about £310 more"
 * is the same fact in a form somebody can plan around.
 *
 * A CAPPED OR TRACKED RATE SAYS WHAT IT FOLLOWS. A variable rate that follows a
 * published index and one the lender sets at will are entirely different
 * promises wearing the same word.
 *
 * NO "BEST" LABEL. Which is better depends on whether the borrower can absorb a
 * rise and how long they will stay, and neither is knowable from here.
 */
export function RateType({ kind, ratePercent, fixedUntil, revertRatePercent, revertPayment, currentPayment, follows, capPercent, currency = "GBP", locale = "en-GB", className }: {
  kind: "fixed" | "variable" | "tracker" | "capped" | "discount";
  ratePercent: number;
  /** When the certainty ends. */
  fixedUntil?: string;
  revertRatePercent?: number;
  /** The payment after it ends. Says more than the rate does. */
  revertPayment?: number;
  currentPayment?: number;
  /** What a variable rate follows, if anything. */
  follows?: string;
  capPercent?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  const jump =
    revertPayment !== undefined && currentPayment !== undefined ? revertPayment - currentPayment : undefined;
  const certain = kind === "fixed" || kind === "capped";
  return (
    <div data-slot="rate-type" className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{ratePercent}%</span>
        <span className="text-muted-foreground"> · {kind}</span>
      </p>
      <p className={cn("text-xs", certain && fixedUntil ? "font-medium" : "text-muted-foreground")}>
        {certain
          ? fixedUntil
            ? `This payment holds until ${fixedUntil}. After that it changes.`
            : "This payment holds, but nobody has said until when."
          : follows
            ? `Moves with ${follows}. Your payment changes when that does.`
            : "The lender can change this whenever they choose."}
      </p>
      {kind === "capped" && capPercent !== undefined && (
        <p className="text-xs text-muted-foreground tabular-nums">It can move, but not above {capPercent}%.</p>
      )}
      {revertPayment !== undefined && (
        <p className={cn("text-xs tabular-nums", jump !== undefined && jump > 0 ? "font-medium" : "text-muted-foreground")}>
          Afterwards the payment is {money(revertPayment)}
          {revertRatePercent !== undefined ? ` at ${revertRatePercent}%` : ""}
          {jump !== undefined && jump > 0 ? ` — ${money(jump)} more a month than now` : ""}.
        </p>
      )}
    </div>
  );
}
