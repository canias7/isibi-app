import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "£14–£55, typically £28" — a set of values as a sentence and a strip.
 *
 * THE TYPICAL VALUE IS THE MEDIAN, and it is labelled "typically", not
 * "average". One £200 restyle pulls a mean above what almost every customer
 * pays; the median is what "usually" means in ordinary speech, and the label
 * matches the maths.
 *
 * THE EXTREMES ARE REAL VALUES from the data, not axis bounds. "From £14"
 * must be a price somebody can actually pay — a padded minimum is a small lie
 * at the exact moment of highest attention.
 *
 * The strip marks min, median and max with the counts behind them available in
 * the accessible name, so "based on 6 prices" is part of the claim.
 *
 * Fewer than three values is a LIST, not a range. "£14–£28" over two prices
 * implies a spread that does not exist.
 */
export function rangeStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { min: sorted[0], max: sorted[sorted.length - 1], median, count: sorted.length };
}

export function RangeSummary({ values, format, label, className }: {
  values: number[];
  format?: (n: number) => string;
  label?: React.ReactNode;
  className?: string;
}) {
  const stats = rangeStats(values);
  const fmt = format ?? ((n: number) => n.toLocaleString());
  if (!stats) return null;

  // Two prices are a list, not a spread.
  if (stats.count < 3) {
    return (
      <p className={cn("text-sm", className)}>
        {label ? <span className="text-muted-foreground">{label}: </span> : null}
        <span className="tabular-nums">{values.map(fmt).join(" and ")}</span>
      </p>
    );
  }

  const span = stats.max - stats.min || 1;
  const at = (n: number) => ((n - stats.min) / span) * 100;

  return (
    <figure className={cn("flex flex-col gap-1.5", className)}>
      <figcaption className="text-sm">
        {label ? <span className="text-muted-foreground">{label}: </span> : null}
        <span className="tabular-nums">{fmt(stats.min)}&ndash;{fmt(stats.max)}</span>
        <span className="text-muted-foreground">, typically </span>
        <strong className="font-semibold tabular-nums">{fmt(stats.median)}</strong>
      </figcaption>
      <div role="img"
        aria-label={`From ${fmt(stats.min)} to ${fmt(stats.max)}, typically ${fmt(stats.median)}, based on ${stats.count} values`}
        className="relative h-4">
        <div aria-hidden className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-muted" />
        {values.map((v, i) => (
          <span key={i} aria-hidden className="absolute top-1 size-2 -translate-x-1/2 rounded-full border border-background bg-muted-foreground/60"
            style={{ left: `${at(v)}%` }} />
        ))}
        <span aria-hidden className="absolute top-0.5 h-3 w-1 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${at(stats.median)}%` }} />
      </div>
    </figure>
  );
}
