import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Money going back, and when it will actually arrive.
 *
 * THE ARRIVAL WINDOW IS THE POINT. A refund marked "processed" is not money in
 * anybody's account, and the gap — often five to ten working days with a card —
 * is where every "where is my refund" message comes from. Saying it once removes
 * most of them.
 *
 * IT NAMES WHERE THE MONEY IS GOING. "Back to the card ending 4242" beats
 * "refunded" for somebody who has changed cards since, which is exactly when
 * this goes wrong.
 *
 * A PARTIAL REFUND SAYS WHY. Refunding £180 of £200 without explaining the £20
 * looks like a mistake or a skim; naming the retained fee makes it a policy.
 */
export function RefundLine({ amount, of, to, arriveBy, retainedFor, currency = "GBP", className }: {
  amount: number;
  /** The original amount, when this is partial. */
  of?: number;
  /** Destination — "the card ending 4242". */
  to?: string;
  /** "5–10 working days" */
  arriveBy?: string;
  /** Why the rest was kept. */
  retainedFor?: string;
  currency?: string;
  className?: string;
}) {
  const partial = typeof of === "number" && of > amount;
  return (
    <div data-slot="refund-line" className={cn("flex flex-col gap-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium"><Money amount={amount} currency={currency} /> refunded</span>
        {partial && <span className="text-muted-foreground"> of <Money amount={of} currency={currency} /></span>}
        {to && <span className="text-muted-foreground"> to {to}</span>}
      </p>
      {arriveBy && <p className="text-xs text-muted-foreground">Usually arrives within {arriveBy}.</p>}
      {partial && retainedFor && (
        <p className="text-xs text-muted-foreground tabular-nums">
          <Money amount={of - amount} currency={currency} /> kept for {retainedFor}.
        </p>
      )}
    </div>
  );
}
