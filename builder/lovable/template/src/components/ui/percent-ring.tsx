import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A single percentage as a ring — for the rare number that really is a
 * percentage.
 *
 * USE `progress-donut` WHEN THERE ARE COUNTS. "12 of 40" as 30% hides the two
 * numbers people track; this exists for genuine rates — occupancy, uptime, a
 * conversion rate — where the percentage IS the fact and there is no countable
 * total worth showing.
 *
 * VALUES OUTSIDE 0-100 ARE CLAMPED AND FLAGGED, not silently drawn. A ring at
 * 140% wraps around itself and reads as 40%, which inverts the message
 * entirely — the number is still printed, with a mark, so the data error is
 * visible instead of disguised.
 *
 * One decimal at most, and none above 10% — 99.97% is a real uptime number and
 * gets its decimals; 42.86% of a small count is false precision.
 *
 * Plain SVG, `role="img"`, spoken once. Same rules as the other rings.
 */
export function PercentRing({ value, label, size = 64, thickness = 7, decimals, className }: {
  value: number;
  label?: React.ReactNode;
  size?: number;
  thickness?: number;
  decimals?: number;
  className?: string;
}) {
  const out = value < 0 || value > 100;
  const clamped = Math.max(0, Math.min(100, value));
  const places = decimals ?? (clamped < 10 || clamped > 99 ? 1 : 0);
  const shown = `${clamped.toFixed(places).replace(/\.0$/, "")}%`;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  return (
    <figure className={cn("flex flex-col items-center gap-1", className)}>
      <div role="img"
        aria-label={`${shown}${label && typeof label === "string" ? ` ${label}` : ""}${out ? ` — the raw value was ${value}, outside 0 to 100` : ""}`}
        className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-muted" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness}
            strokeLinecap="round" strokeDasharray={`${(clamped / 100) * c} ${c}`}
            className="stroke-foreground" />
        </svg>
        <span aria-hidden className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">
          {shown}{out ? "!" : ""}
        </span>
      </div>
      {label ? <figcaption className="text-xs text-muted-foreground">{label}</figcaption> : null}
      {/* The data error stays visible instead of being disguised by the clamp. */}
      {out ? <p className="text-[11px] font-medium">Raw value {value} — outside 0&ndash;100</p> : null}
    </figure>
  );
}
