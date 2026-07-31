import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "+12% on last month" as a compact pill.
 *
 * WHETHER UP IS GOOD IS THE CALLER'S CLAIM, never inferred from the sign.
 * Cancellations going up is bad news wearing a plus sign; `goodWhenUp={false}`
 * flips the emphasis, not the arrow. Same contract as `metric-delta`, in pill
 * form for tables and card corners.
 *
 * THE BASELINE IS NAMED IN THE ACCESSIBLE TEXT even when the visible pill is
 * just "+12%" — a delta with no baseline is the most misread number on any
 * dashboard, so the full sentence lives in sr-only when space is tight.
 *
 * ZERO IS "no change", not "+0%", which reads as a rounding artefact.
 *
 * NEW — where the previous period was zero — is its own state. Dividing by
 * zero to get "+∞%" is mathematically honest and completely useless.
 */
export function DeltaPill({ value, baseline, goodWhenUp = true, isNew, format, className }: {
  value: number;
  baseline?: string;
  goodWhenUp?: boolean;
  isNew?: boolean;
  format?: (n: number) => string;
  className?: string;
}) {
  if (isNew) {
    return (
      <span className={cn("inline-flex items-center rounded-full border border-foreground px-1.5 py-0.5 text-[10px] font-medium", className)}>
        New
        {baseline ? <span className="sr-only"> — nothing in {baseline}</span> : null}
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className={cn("inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground", className)}>
        no change{baseline ? <span className="sr-only"> on {baseline}</span> : null}
      </span>
    );
  }
  const up = value > 0;
  const good = up === goodWhenUp;
  const shown = format ? format(Math.abs(value)) : `${Math.abs(value).toLocaleString()}%`;

  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
      good ? "bg-foreground font-medium text-background" : "border-2 border-foreground font-semibold", className)}>
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {shown}
      <span className="sr-only">
        {up ? "up" : "down"} {shown}{baseline ? ` on ${baseline}` : ""} — {good ? "better" : "worse"}
      </span>
    </span>
  );
}
