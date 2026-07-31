/**
 * An amount of money, in the visitor's locale.
 *
 * Intl.NumberFormat rather than a template string, so the symbol lands on the
 * right side and the separators are right — €1.234,56 in Berlin and £1,234.56 in
 * London are the same call.
 */
export function Money({ amount, currency = "GBP", className }: {
  amount: number; currency?: string; className?: string;
}) {
  const text = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  return <span className={className ? className + " tabular-nums" : "tabular-nums"}>{text}</span>;
}
