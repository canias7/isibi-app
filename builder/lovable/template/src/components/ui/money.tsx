/**
 * An amount of money, in the visitor's locale.
 *
 * Intl.NumberFormat rather than a template string, so the symbol lands on the
 * right side and the separators are right — €1.234,56 in Berlin and £1,234.56 in
 * London are the same call.
 *
 * A SYMBOL MUST NOT TAKE THE PAGE DOWN, and until 2026-08-02 it did. The
 * `currency` style demands an ISO 4217 code and Intl THROWS a RangeError on
 * anything else, so `currency="£"` crashed — through React's error boundary,
 * taking the WHOLE page with it, not just the price. Measured on a checkout
 * page that rendered eight nodes and an apology.
 *
 * It is reachable from an ordinary caller because the kit runs two conventions:
 * 109 components default `currency` to "GBP" and nine to "£" — `PriceList`,
 * `PriceTag`, `CartLine`, `CartSummary` and `MenuSection` among them. Anybody
 * passing the symbol those five want, into any of the 24 components that
 * forward here, hit it. Fixing the leaf fixes all 24 at once.
 *
 * The fallback treats an unrecognised code as the symbol the caller plainly
 * meant, rather than rendering nothing or a placeholder: "£6" is what they were
 * asking for, and a formatting disagreement is never worth a blank page.
 */
export function Money({ amount, currency = "GBP", className }: {
  amount: number;
  /** ISO 4217 ("GBP"). A bare symbol ("£") is accepted and used as a prefix. */
  currency?: string;
  className?: string;
}) {
  let text: string;
  try {
    text = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    text = currency + amount.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }
  return <span className={className ? className + " tabular-nums" : "tabular-nums"}>{text}</span>;
}
