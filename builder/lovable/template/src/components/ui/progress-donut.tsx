import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A ring showing a proportion, with the fraction in the middle.
 *
 * IT SHOWS "12 / 40", NOT "30%". A percentage of a small total is a false
 * precision — three of seven is 42.86% and nobody wants that — and the two
 * numbers are what somebody is actually tracking. The percentage is available
 * as the accessible value, where a screen reader benefits from one number.
 *
 * ZERO STILL DRAWS THE TRACK. A ring that vanishes at zero reads as a failed
 * render, and zero-of-forty is a real and common state.
 *
 * IT IS PLAIN SVG with `stroke-dasharray`, no chart library — the same call as
 * `cell-sparkline`. A donut has no axes, no legend and no tooltip; everything a
 * chart library brings is weight.
 *
 * `role="img"` with a spoken label, and the ring itself `aria-hidden`, so a
 * listener hears "12 of 40 bookings taken, 30 per cent" once rather than a
 * stream of path data.
 */
export function ProgressDonut({ value, total, size = 72, thickness = 8, label, className }: {
  value: number;
  total: number;
  size?: number;
  thickness?: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const safeTotal = Math.max(1, total);
  const frac = Math.max(0, Math.min(1, value / safeTotal));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const spoken = `${value.toLocaleString()} of ${total.toLocaleString()}${label && typeof label === "string" ? ` ${label}` : ""}, ${Math.round(frac * 100)} per cent`;

  return (
    <figure data-slot="progress-donut" className={cn("flex flex-col items-center gap-1", className)}>
      <div role="img" aria-label={spoken} className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden className="-rotate-90">
          {/* The track is always drawn: a vanishing ring reads as a broken render. */}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness}
            className="stroke-muted" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness}
            strokeLinecap="round" strokeDasharray={`${frac * circumference} ${circumference}`}
            className="stroke-foreground" />
        </svg>
        <span aria-hidden className="absolute inset-0 grid place-items-center text-center leading-tight">
          <span>
            <span className="block text-sm font-semibold tabular-nums">{value.toLocaleString()}</span>
            <span className="block text-[10px] text-muted-foreground tabular-nums">of {total.toLocaleString()}</span>
          </span>
        </span>
      </div>
      {label ? <figcaption className="text-xs text-muted-foreground">{label}</figcaption> : null}
    </figure>
  );
}
