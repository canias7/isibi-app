import { cn } from "@/lib/utils";
/**
 * "Charged in euros. Your bank may convert."
 *
 * THE SURPRISE THIS PREVENTS is a card statement that does not match the price
 * on screen. A price shown in the reader's currency and charged in another is
 * technically honest and reads as a bait and switch — the conversion, and the
 * fact that the bank's rate is not ours, has to be said before the press.
 *
 * IT NAMES WHO SETS THE RATE. "Your bank decides the rate and may add a fee" is
 * the honest version; implying we know the final figure when the card issuer
 * does is a promise that cannot be kept.
 *
 * Deliberately plain and adjacent to the total rather than in small print at the
 * foot, because that is where it is read.
 */
export function CurrencyNote({ charged, shown, className }: {
  /** The currency the card is charged in — "EUR". */
  charged: string;
  /** The currency being displayed, if different. */
  shown?: string;
  className?: string;
}) {
  if (shown && shown === charged) return null;
  return (
    <p data-slot="currency-note" className={cn("text-xs text-muted-foreground", className)}>
      Charged in {charged}
      {shown ? ` rather than ${shown}` : ""}. Your bank sets the exchange rate and may add a fee.
    </p>
  );
}
