import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A min/max range filter with the distribution drawn behind it.
 *
 * THE HISTOGRAM IS THE POINT. A price slider from £0 to £500 on a shop where
 * everything costs £12–£35 wastes 93% of its travel, and the bars are what tell
 * somebody that before they drag. Without them this is two number boxes.
 *
 * They are TWO NUMBER INPUTS as well as a slider, because typing 30 is faster
 * and more precise than aiming at it — and on a phone a two-thumb slider is
 * genuinely hard to operate.
 *
 * Min and max CANNOT CROSS. The naive version lets the min be dragged past the
 * max and produces an empty result set with no explanation; here each clamps
 * against the other.
 *
 * Bars outside the chosen range are hollow rather than hidden, so the reader
 * can still see what they are excluding — which is what tells them whether to
 * widen it again.
 */
export function FacetRange({
  min, max, value, onChange, buckets = [], format, label, className,
}: {
  min: number;
  max: number;
  value: { from: number; to: number };
  onChange: (next: { from: number; to: number }) => void;
  buckets?: number[];
  format?: (n: number) => string;
  label?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const top = Math.max(...buckets, 1);
  const span = Math.max(1, max - min);
  const at = (n: number) => ((n - min) / span) * 100;

  return (
    <div data-slot="facet-range" className={cn("flex flex-col gap-2", className)}>
      {label ? <p className="text-xs font-medium">{label}</p> : null}
      {buckets.length ? (
        <div aria-hidden className="flex h-10 items-end gap-px">
          {buckets.map((b, i) => {
            const centre = min + ((i + 0.5) / buckets.length) * span;
            const inside = centre >= value.from && centre <= value.to;
            return (
              <span key={i} style={{ height: `${Math.max(6, (b / top) * 100)}%` }}
                className={cn("flex-1 rounded-t-xs", inside ? "bg-foreground" : "border border-b-0 border-muted-foreground/50")} />
            );
          })}
        </div>
      ) : null}
      <div aria-hidden className="relative h-1 rounded-full bg-muted">
        <span className="absolute inset-y-0 rounded-full bg-foreground"
          style={{ left: `${at(value.from)}%`, right: `${100 - at(value.to)}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-a`} className="sr-only">Minimum</label>
        <input id={`${id}-a`} type="number" inputMode="decimal" value={value.from} min={min} max={value.to}
          onChange={(e) => onChange({ ...value, from: Math.min(value.to, Math.max(min, Number(e.target.value))) })}
          className="h-8 w-20 rounded border border-border bg-background px-2 text-xs tabular-nums outline-none focus-visible:border-ring" />
        <span aria-hidden className="text-xs text-muted-foreground">to</span>
        <label htmlFor={`${id}-b`} className="sr-only">Maximum</label>
        <input id={`${id}-b`} type="number" inputMode="decimal" value={value.to} min={value.from} max={max}
          onChange={(e) => onChange({ ...value, to: Math.max(value.from, Math.min(max, Number(e.target.value))) })}
          className="h-8 w-20 rounded border border-border bg-background px-2 text-xs tabular-nums outline-none focus-visible:border-ring" />
        <span className="ms-auto text-xs text-muted-foreground tabular-nums">
          {fmt(min)}&ndash;{fmt(max)}
        </span>
      </div>
    </div>
  );
}
