import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * Money DISPLAYED from minor units — the other half of amount-input.
 *
 * TAKES PENNIES (`minor`), formats via Intl (the Money rule: symbol side
 * and separators come from the locale, never a template string), so the
 * pair amount-input → storage → currency-amount never touches a float.
 *
 * ZERO IS NOT FREE. £0.00 is a price (a deposit refunded, a comped cut);
 * "Free" is a marketing claim the CALLER makes with `zeroAs="free"` —
 * defaulting to the word would turn every zero-balance ledger row into
 * an advert.
 *
 * NEGATIVE WEARS A REAL MINUS and optional accounting parentheses —
 * the sr-only text says "minus", because a bare "−" glyph is skipped by
 * some screen readers and a refund read as a charge is the worst
 * possible misreading.
 *
 * THE DIVISOR IS NOT 100. It was, while `currency` is a free-form prop, so a
 * zero-decimal currency was shown at a HUNDREDTH of its value: ¥1,200 rendered
 * as ¥12. Three-decimal currencies (KWD, BHD, OMR) went the other way by ten.
 * `site-payments.mjs` records exactly this on the charging path — "a hardcoded
 * ×100 charges a hundred times the price" — and the display half had the same
 * constant. Intl already knows every currency's exponent, so it is asked
 * rather than tabulated: nothing here needs maintaining when a currency
 * redenominates.
 */

export function CurrencyAmount({ minor, currency = "GBP", zeroAs, parentheses, className }: {
  minor: number;
  currency?: string;
  zeroAs?: "free";
  parentheses?: boolean;
  className?: string;
}) {
  if (minor === 0 && zeroAs === "free") {
    return <span data-slot="currency-amount" className={cn("font-medium", className)}>Free</span>;
  }
  // Shared with the eighteen other components that display minor units, so the
  // exponent is worked out in ONE place rather than nineteen.
  const abs = formatMinor(Math.abs(minor), currency);
  if (minor < 0) {
    return (
      <span className={cn("tabular-nums", className)}>
        <span className="sr-only">minus </span>
        {parentheses ? `(${abs})` : `−${abs}`}
      </span>
    );
  }
  return <span className={cn("tabular-nums", className)}>{abs}</span>;
}
