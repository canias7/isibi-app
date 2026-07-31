import * as React from "react";
import { cn } from "@/lib/utils";
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
 */
export function CurrencyAmount({ minor, currency = "GBP", zeroAs, parentheses, className }: {
  minor: number;
  currency?: string;
  zeroAs?: "free";
  parentheses?: boolean;
  className?: string;
}) {
  if (minor === 0 && zeroAs === "free") {
    return <span className={cn("font-medium", className)}>Free</span>;
  }
  const abs = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Math.abs(minor) / 100);
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
