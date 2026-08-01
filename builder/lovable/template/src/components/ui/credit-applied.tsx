import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Existing credit taken off this bill.
 *
 * IT SAYS WHAT IS LEFT AFTERWARDS. Applying credit without showing the remaining
 * balance means the customer has to track it themselves, and they will not — the
 * next bill then arrives as a surprise.
 *
 * PARTIAL APPLICATION IS THE NORMAL CASE and is stated plainly: credit larger
 * than the bill covers it entirely and rolls over, credit smaller reduces it.
 * Both are shown as one sentence rather than requiring the reader to compare two
 * numbers.
 *
 * The amount applied is negative in the breakdown but written as a positive with
 * the word "off", which is how people read a deduction.
 */
export function CreditApplied({ applied, remaining, source, currency = "GBP", className }: {
  applied: number;
  /** Credit left after this bill. */
  remaining?: number;
  /** Where the credit came from — "your cancelled booking". */
  source?: string;
  currency?: string;
  className?: string;
}) {
  if (applied <= 0) return null;
  return (
    <p className={cn("text-sm", className)}>
      <span className="tabular-nums">
        <Money amount={applied} currency={currency} /> off
      </span>
      {source && <span className="text-muted-foreground"> from {source}</span>}
      {typeof remaining === "number" && (
        <span className="text-muted-foreground tabular-nums">
          {" · "}
          {remaining > 0
            ? <><Money amount={remaining} currency={currency} /> credit left</>
            : "no credit left"}
        </span>
      )}
    </p>
  );
}
