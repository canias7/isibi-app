import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * The few pence added or removed to reach a round figure.
 *
 * A TOTAL THAT DOES NOT ADD UP DESTROYS CONFIDENCE IN EVERYTHING ABOVE IT. When
 * cash rounding, VAT rounding or a currency without small coins moves the
 * figure, an unexplained penny is worse than the penny is worth — people
 * recompute the whole bill.
 *
 * IT SHOWS THE SIGN AND THE REASON. "Rounding −£0.02 (nearest 5p)" is a complete
 * explanation; "Adjustment £0.02" is the thing that makes somebody call.
 *
 * Renders nothing at zero, so it can sit permanently in a bill template without
 * printing a meaningless line on every receipt that happened to come out even.
 */
export function RoundingLine({ amount, reason, currency = "GBP", className }: {
  /** Signed — negative when the total came down. */
  amount: number;
  /** "nearest 5p" */
  reason?: string;
  currency?: string;
  className?: string;
}) {
  if (!amount) return null;
  return (
    <div data-slot="rounding-line" className={cn("flex justify-between gap-4 text-sm text-muted-foreground", className)}>
      <span>Rounding{reason ? ` (${reason})` : ""}</span>
      <span className="shrink-0 tabular-nums">
        {amount > 0 ? "+" : "−"}<Money amount={Math.abs(amount)} currency={currency} />
      </span>
    </div>
  );
}
