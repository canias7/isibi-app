import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * A charge on top, with the reason attached.
 *
 * AN UNEXPLAINED FEE IS THE COMMONEST REASON A CHECKOUT IS ABANDONED. "Service
 * charge £3.40" invites suspicion; "Service charge — covers card processing and
 * the booking system" does not, and it costs one line.
 *
 * IT SAYS WHETHER THE FEE IS AVOIDABLE. A charge that disappears if you pay
 * differently, or collect rather than deliver, is one people want the chance to
 * avoid — and hiding that is the part that generates complaints rather than the
 * fee itself.
 *
 * `perUnit` is stated where it applies, because "£1.20 each × 3" is checkable
 * and "£3.60" is a number to be taken on trust.
 */
export function FeeLine({ label, amount, why, avoidableBy, perUnit, quantity, currency = "GBP", className }: {
  label: string;
  amount: number;
  /** What the fee covers. */
  why?: string;
  /** How to not pay it — "collecting in person". */
  avoidableBy?: string;
  perUnit?: number;
  quantity?: number;
  currency?: string;
  className?: string;
}) {
  return (
    <div data-slot="fee-line" className={cn("flex justify-between gap-4 text-sm", className)}>
      <span className="min-w-0">
        <span>{label}</span>
        {typeof perUnit === "number" && typeof quantity === "number" && (
          <span className="text-muted-foreground tabular-nums">
            {" "}(<Money amount={perUnit} currency={currency} /> × {quantity})
          </span>
        )}
        {why && <span className="block text-xs text-muted-foreground">{why}</span>}
        {avoidableBy && (
          <span className="block text-xs text-muted-foreground">Not charged when {avoidableBy}.</span>
        )}
      </span>
      <span className="shrink-0 tabular-nums"><Money amount={amount} currency={currency} /></span>
    </div>
  );
}
