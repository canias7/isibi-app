import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Numbers are rounded, so the columns may not add up" — said before somebody
 * checks.
 *
 * IT ONLY APPEARS WHEN THE ROUNDING ACTUALLY BITES. `roundingGap` compares the
 * rounded parts against the rounded total and returns the discrepancy; when it
 * is zero the note renders nothing, because a permanent disclaimer trains
 * people to ignore the one table where it matters.
 *
 * IT STATES THE GAP — "parts add to 99%, the total is 100%" — rather than a
 * vague warning. The reader who noticed the mismatch has done arithmetic; the
 * note has to meet them with the same specificity or it reads as an excuse.
 *
 * This exists because the alternative fixes are worse: forcing the parts to
 * add up (largest-remainder) changes individually-correct numbers, and showing
 * full precision defeats the rounding. Saying so is the honest option.
 */
export function roundingGap(parts: number[], places = 0): number {
  const f = 10 ** places;
  const roundedSum = parts.reduce((n, p) => n + Math.round(p * f) / f, 0);
  const trueSum = parts.reduce((n, p) => n + p, 0);
  const roundedTrue = Math.round(trueSum * f) / f;
  return Number((roundedSum - roundedTrue).toFixed(places + 2));
}

export function RoundingNote({ parts, places = 0, unit = "", className }: {
  parts: number[];
  places?: number;
  unit?: string;
  className?: string;
}) {
  const gap = roundingGap(parts, places);
  // Silent when the rounding does not bite: a permanent disclaimer is ignored.
  if (gap === 0) return null;
  const f = 10 ** places;
  const roundedSum = parts.reduce((n, p) => n + Math.round(p * f) / f, 0);
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Because of rounding, the parts add to{" "}
      <span className="tabular-nums">{Number(roundedSum.toFixed(places))}{unit}</span> rather than the total —
      a difference of <span className="tabular-nums">{Math.abs(gap)}{unit}</span>. Each figure is
      individually correct.
    </p>
  );
}
