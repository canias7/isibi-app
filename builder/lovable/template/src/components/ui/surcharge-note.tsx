import { cn } from "@/lib/utils";
/**
 * "Card payments carry 1.5%."
 *
 * SHOWN BEFORE THE PAYMENT METHOD IS CHOSEN, not after. A surcharge that appears
 * once a card is selected is the definition of a hidden cost — and in several
 * places it is also the difference between legal and not.
 *
 * IT NAMES THE ALTERNATIVE. A surcharge with no cheaper route is just a price
 * rise; "no charge on bank transfer" gives the reader something to do with the
 * information, which is the only reason to show it early.
 *
 * The rate and the money are both given when the caller knows the amount,
 * because 1.5% is abstract and £3.98 is not.
 */
export function SurchargeNote({ label, ratePct, amountText, freeAlternative, className }: {
  /** What triggers it — "Card payments". */
  label: string;
  ratePct?: number;
  /** The cash figure, already formatted by the caller. */
  amountText?: string;
  /** A route with no surcharge — "bank transfer". */
  freeAlternative?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span className="font-medium text-foreground tabular-nums">
        {label} carry{typeof ratePct === "number" ? ` ${ratePct}%` : " a surcharge"}
        {amountText ? ` (${amountText})` : ""}
      </span>
      {freeAlternative && <> — no charge on {freeAlternative}.</>}
    </p>
  );
}
