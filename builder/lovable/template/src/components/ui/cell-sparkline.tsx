import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A trend line small enough to live in a table cell. Plain SVG, no chart
 * library — a sparkline has no axes, no legend, no tooltip and no grid, so
 * everything a chart library brings is weight for features this deliberately
 * does not have.
 *
 * The LAST point is marked. Without it the eye has to work out which end is
 * "now", and half the readers guess wrong on a chart four centimetres wide.
 *
 * The accessible name is the numbers, not "sparkline" — a screen reader that
 * announces the shape of the graphic has told the listener nothing, while
 * "12, 19, 14, 31, last 31" is the whole content.
 */
export function CellSparkline({
  values, width = 72, height = 20, label, format, className,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return <span className={cn("text-xs text-muted-foreground", className)}>&mdash;</span>;

  const min = Math.min(...clean), max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (clean.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = clean.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const name = `${label ? label + ": " : ""}${clean.map(fmt).join(", ")}. Latest ${fmt(clean[clean.length - 1])}.`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label={name} className={cn("overflow-visible align-middle", className)}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25}
        strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" />
      <circle cx={x(clean.length - 1)} cy={y(clean[clean.length - 1])} r={2} fill="currentColor" />
    </svg>
  );
}
