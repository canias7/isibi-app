import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The one number a dashboard card exists to show.
 *
 * IT IS NEVER ALONE. A bare "1,247" is a number with no claim; the label says
 * what it counts, the period says over when, and the comparison says whether it
 * is news. A big number missing any of the three is decoration, and the period
 * is the one that gets dropped — "revenue: £4,200" spanning an unstated window
 * is unusable.
 *
 * PRECISION MATCHES SIZE. Past ten thousand, the trailing digits are noise at
 * a glance — 12,481 renders as 12.5k with the exact value in the title and the
 * accessible name. Below that, exact. `Intl.NumberFormat compact` does the
 * locale work.
 *
 * `tabular-nums`, because these sit in rows of cards and jitter otherwise.
 *
 * The comparison is a slot for `metric-delta` or `delta-pill` rather than a
 * number prop — direction-is-good is the caller's judgement and this component
 * must not guess it.
 */
export function BigNumber({ value, label, period, compare, format, compactFrom = 10000, className }: {
  value: number;
  label: React.ReactNode;
  period: React.ReactNode;
  compare?: React.ReactNode;
  format?: (n: number) => string;
  compactFrom?: number;
  className?: string;
}) {
  const exact = format ? format(value) : value.toLocaleString();
  const shown = format ? format(value)
    : Math.abs(value) >= compactFrom
      ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
      : value.toLocaleString();

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold tabular-nums" title={shown === exact ? undefined : exact}>
        <span aria-hidden>{shown}</span>
        <span className="sr-only">{exact}</span>
      </p>
      <p className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        {/* The period is the part that gets dropped, and without it the number is unusable. */}
        <span>{period}</span>
        {compare}
      </p>
    </div>
  );
}
