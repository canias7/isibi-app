import { cn } from "@/lib/utils";
/**
 * A number printed to the precision it was actually measured to.
 *
 * COMPUTED NUMBERS CARRY FAKE PRECISION and it is everywhere: a percentage from
 * a division comes out 33.33333333333333, a unit conversion gives
 * 8.046719999999999, an average of three integers gives 4.666666666666667.
 * Printing all of it claims a measurement nobody made and makes a table
 * unreadable.
 *
 * SIGNIFICANT FIGURES, NOT DECIMAL PLACES, which is the distinction that
 * matters when a column spans magnitudes: two decimal places gives 0.00 for a
 * small value and eight digits for a large one, while three significant figures
 * gives 0.00847 and 12,400 — both readable, both honestly precise.
 *
 * `Intl.NumberFormat` WITH `maximumSignificantDigits`, so grouping and the
 * decimal separator stay correct in every locale. Hand-rolled `toPrecision`
 * gives "1.24e+4" for large numbers and a full stop where a comma belongs.
 *
 * ZERO IS PRINTED AS "0", not "0.00" — significant figures on zero are
 * meaningless and the padded form implies a measured quantity.
 */
export function SignificantFigures({ value, digits = 3, locale, className }: {
  value: number;
  digits?: number;
  locale?: string;
  className?: string;
}) {
  if (!Number.isFinite(value)) return null;
  if (value === 0) return <span data-slot="significant-figures" className={cn("tabular-nums", className)}>0</span>;
  const text = new Intl.NumberFormat(locale, {
    maximumSignificantDigits: Math.max(1, Math.min(21, digits)),
  }).format(value);
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}
