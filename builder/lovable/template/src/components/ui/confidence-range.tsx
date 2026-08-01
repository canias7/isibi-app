import { cn } from "@/lib/utils";
/**
 * A number with the honest spread around it.
 *
 * THE RANGE IS AS PROMINENT AS THE ESTIMATE. Printing "£4,200" large with
 * "±£800" in grey teaches the reader to ignore the part that matters — and an
 * estimate quoted without its spread is heard as a quote, which is how disputes
 * start.
 *
 * The bounds are stated as real numbers rather than a ± figure the reader has
 * to compute twice. "£3,400 to £5,000" is what somebody needs to decide whether
 * they can afford it.
 *
 * `basis` says where the range came from — "based on 14 similar jobs". A
 * confidence interval with no provenance is a decoration that borrows the
 * authority of statistics.
 */
export function ConfidenceRange({ value, low, high, unit = "", basis, label, className }: {
  value: number; low: number; high: number; unit?: string;
  /** Where the spread comes from. */
  basis?: string;
  label?: string;
  className?: string;
}) {
  const fmt = (n: number) => `${unit}${n.toLocaleString()}`;
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{fmt(value)}</span>
      <span className="text-sm tabular-nums">{fmt(low)} to {fmt(high)}</span>
      {basis && <span className="text-xs text-muted-foreground">{basis}</span>}
    </div>
  );
}
