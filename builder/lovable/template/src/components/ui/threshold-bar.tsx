import * as React from "react";
import { cn, divide } from "@/lib/utils";
/**
 * A value against the line where something happens — free postage, an
 * overdraft, a rate limit.
 *
 * THE CONSEQUENCE IS THE LABEL, not the number. "£6.50 away from free
 * delivery" is what changes behaviour; "43.50 / 50.00" is bookkeeping. The
 * threshold's meaning is a required prop because without it this is just a
 * progress bar.
 *
 * CROSSING IS A STATED EVENT — the bar says "passed" once over, because the
 * moment of crossing is the entire reason to watch it, and a bar that fills
 * silently makes somebody re-derive the answer.
 *
 * DIRECTION MATTERS: approaching free delivery is good, approaching a rate
 * limit is not. `goodWhenOver` sets which side gets the emphasis, the same
 * contract every delta in this kit uses.
 *
 * The remaining amount is in the accessible text as a sentence, not two
 * numbers a listener has to subtract.
 */
export function ThresholdBar({ value, threshold, consequence, goodWhenOver = true, format, max, className }: {
  value: number;
  threshold: number;
  consequence: React.ReactNode;
  goodWhenOver?: boolean;
  format?: (n: number) => string;
  max?: number;
  className?: string;
}) {
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const top = max ?? Math.max(threshold * 1.25, value);
  const at = (n: number) => Math.max(0, Math.min(100, divide(n, top) * 100));
  const over = value >= threshold;
  const away = threshold - value;

  return (
    <figure data-slot="threshold-bar" className={cn("flex flex-col gap-1", className)}>
      <figcaption className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cn(over === goodWhenOver ? "" : over ? "font-semibold" : "")}>
          {over
            ? <><strong className="font-semibold">Passed</strong> — {consequence}</>
            : <><span className="font-medium tabular-nums">{fmt(away)}</span> away from {consequence}</>}
        </span>
        <span className="text-muted-foreground tabular-nums">{fmt(value)}</span>
      </figcaption>
      <div role="img"
        aria-label={over
          ? `Past the threshold: ${typeof consequence === "string" ? consequence : "reached"}`
          : `${fmt(away)} away from ${typeof consequence === "string" ? consequence : "the threshold"}`}
        className="relative h-4">
        <div aria-hidden className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-muted" />
        <div aria-hidden className="absolute top-1.5 start-0 h-1 rounded-full bg-foreground" style={{ width: `${at(value)}%` }} />
        {/* The line where something happens, always visible. */}
        <span aria-hidden className="absolute top-0.5 h-3 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${at(threshold)}%` }} />
        <span aria-hidden className="absolute top-4 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums"
          style={{ left: `${at(threshold)}%` }}>{fmt(threshold)}</span>
      </div>
      <span aria-hidden className="h-2.5" />
    </figure>
  );
}
