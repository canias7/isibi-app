import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * "You've paid £40 more than the bill."
 *
 * OVERPAYMENT IS USUALLY HANDLED SILENTLY, and silence is the wrong answer: the
 * customer does not know their money is sitting somewhere, and the business
 * looks like it has pocketed it.
 *
 * IT OFFERS BOTH RESOLUTIONS, because either is legitimate and only the customer
 * knows which they want — refund it, or hold it against the next bill. Choosing
 * for them is what generates the complaint.
 *
 * `role="status"` so it is announced when it appears, since it usually renders
 * in response to a payment the reader just made.
 */
export function OverpaymentNote({ amount, currency = "GBP", onRefund, onHold, className }: {
  amount: number;
  currency?: string;
  onRefund?: () => void;
  onHold?: () => void;
  className?: string;
}) {
  if (amount <= 0) return null;
  return (
    <p role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-sm", className)}>
      <span className="font-medium tabular-nums">
        <Money amount={amount} currency={currency} /> more than the bill
      </span>
      {onRefund && (
        <button type="button" onClick={onRefund} className="cursor-pointer underline underline-offset-4">Refund it</button>
      )}
      {onHold && (
        <button type="button" onClick={onHold} className="cursor-pointer underline underline-offset-4">Keep it against the next bill</button>
      )}
    </p>
  );
}
