import { cn } from "@/lib/utils";
/**
 * The spread drawn as a band, with the estimate inside it.
 *
 * The visual sibling of `confidence-range`: same honesty, but placed on a scale
 * so several estimates can be compared down a page. Reading three quotes as
 * three ranges is what shows that two of them overlap entirely.
 *
 * THE SCALE IS SHARED, passed in by the caller as min and max. Bands drawn to
 * their own extents look identical whatever they contain, which makes the
 * picture actively misleading — the one failure this component must not have.
 *
 * `aria-hidden` on the drawing with the numbers written out beneath, since a
 * band is unreadable to a screen reader and the figures are the content.
 *
 * `unit` GOES IN FRONT AND `suffix` GOES BEHIND, and there are two of them
 * because a single ambiguous slot guarantees one of the two gets used wrongly.
 * Money is written £1,428 and a quantity is written 1,428 kWh — with only
 * `unit` to reach for, a caller wanting the second writes `unit="kWh"` and
 * gets "kWh1428". Measured on a real page: a solar estimator passed
 * `unit="£ a year"` and every figure on it read "£ a year928".
 */
export function EstimateBand({ low, high, value, min, max, label, unit = "", suffix = "", className }: {
  low: number; high: number;
  /** The point estimate inside the band. */
  value?: number;
  /** Shared scale — the same on every band being compared. */
  min: number; max: number;
  label?: string;
  /** Written BEFORE the number: a currency symbol. */
  unit?: string;
  /** Written AFTER it, with a space: kWh, m², "a year". */
  suffix?: string;
  className?: string;
}) {
  const span = max - min;
  if (span <= 0) return null;
  const at = (n: number) => `${Math.min(Math.max(((n - min) / span) * 100, 0), 100)}%`;
  const fmt = (n: number) => `${unit}${n.toLocaleString()}${suffix ? ` ${suffix}` : ""}`;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-sm">{label}</span>}
      <div aria-hidden className="relative h-3 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-foreground/25"
          style={{ left: at(low), right: `calc(100% - ${at(high)})` }} />
        {typeof value === "number" && (
          <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: at(value) }} />
        )}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {fmt(low)} to {fmt(high)}{typeof value === "number" ? ` · likely ${fmt(value)}` : ""}
      </span>
    </div>
  );
}
