import * as React from "react";
import { cn, divide } from "@/lib/utils";
/**
 * A measured value against its acceptable band.
 *
 * THE BAND IS DRAWN AND THE VERDICT IS WRITTEN. "Within range" or "0.3 over"
 * in words is the answer; the bar shows how close. A bar without the verdict
 * makes the reader judge pixel positions, which is what the component exists
 * to do for them.
 *
 * OUT-OF-RANGE DOES NOT CLIP. A value 40% past the limit drawn at the edge of
 * the bar looks marginal; the marker leaves the band region and the overflow is
 * drawn, because how far out is the whole finding.
 *
 * The band edges are LABELLED WITH THEIR NUMBERS, not just ticks — min and max
 * are facts somebody checks against a spec sheet.
 *
 * Marker by SHAPE (a triangle) and fill, never colour; the same monochrome
 * discipline as every gauge in this kit.
 */
export function ToleranceBar({ value, min, max, unit, label, span, className }: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  label?: React.ReactNode;
  span?: [number, number];
  className?: string;
}) {
  const lo = span?.[0] ?? min - (max - min) * 0.4;
  const hi = span?.[1] ??  max + (max - min) * 0.4;
  const width = hi - lo || 1;
  const at = (n: number) => Math.max(0, Math.min(100, divide(n - lo, width) * 100));
  const inRange = value >= min && value <= max;
  const off = value < min ? min - value : value > max ? value - max : 0;
  const u = unit ? ` ${unit}` : "";
  const verdict = inRange
    ? "within range"
    : `${Number(off.toFixed(2)).toLocaleString()}${u} ${value < min ? "under" : "over"}`;

  return (
    <figure data-slot="tolerance-bar" className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <figcaption className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium">{label}</span>
          <span className={cn("tabular-nums", inRange ? "text-muted-foreground" : "font-semibold")}>
            {value.toLocaleString()}{u} &mdash; {verdict}
          </span>
        </figcaption>
      ) : null}
      <div role="img" aria-label={`${value.toLocaleString()}${u}, allowed ${min.toLocaleString()} to ${max.toLocaleString()}${u} — ${verdict}`}
        className="relative h-6">
        <div aria-hidden className="absolute inset-x-0 top-2.5 h-1 rounded-full bg-muted" />
        <div aria-hidden className="absolute top-1.5 h-3 rounded-sm bg-foreground/15"
          style={{ left: `${at(min)}%`, width: `${at(max) - at(min)}%` }} />
        {/* The marker leaves the band; how far out is the finding. */}
        <span aria-hidden
          className={cn("absolute top-0 -translate-x-1/2", inRange ? "" : "font-bold")}
          style={{ left: `${at(value)}%` }}>
          <span className={cn("block size-0 border-x-4 border-t-6 border-x-transparent",
            inRange ? "border-t-foreground" : "border-t-foreground")} />
        </span>
        <span aria-hidden className="absolute -bottom-3 text-[10px] text-muted-foreground tabular-nums"
          style={{ left: `${at(min)}%`, transform: "translateX(-50%)" }}>{min.toLocaleString()}</span>
        <span aria-hidden className="absolute -bottom-3 text-[10px] text-muted-foreground tabular-nums"
          style={{ left: `${at(max)}%`, transform: "translateX(-50%)" }}>{max.toLocaleString()}</span>
      </div>
      <span aria-hidden className="h-2" />
    </figure>
  );
}
