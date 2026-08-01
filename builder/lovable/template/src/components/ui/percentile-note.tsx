import { cn } from "@/lib/utils";
/**
 * "Faster than 82% of them."
 *
 * PHRASED AS A COMPARISON, not as a rank. "82nd percentile" is jargon most
 * readers decode wrongly, and "18th out of 100" invites the question of who the
 * other 99 are. "Faster than 82%" needs no explanation.
 *
 * THE DIRECTION WORD IS THE CALLER'S, because a percentile is meaningless
 * without knowing whether high is good. Faster, cheaper, busier and later all
 * fit this shape and half of them are compliments.
 *
 * Small samples get an explicit caveat rather than a confident percentage: a
 * percentile over 9 records is arithmetic, not evidence, and rounding it to a
 * whole number hides how few there were.
 */
export function PercentileNote({ percentile, comparison, sampleSize, minSample = 20, className }: {
  /** 0-100. */
  percentile: number;
  /** "faster than", "busier than" — the caller owns the direction. */
  comparison: string;
  sampleSize?: number;
  minSample?: number;
  className?: string;
}) {
  const p = Math.round(Math.min(Math.max(percentile, 0), 100));
  const thin = typeof sampleSize === "number" && sampleSize < minSample;
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-medium tabular-nums">{comparison} {p}%</span>
      {typeof sampleSize === "number" && (
        <span className="text-muted-foreground">
          {" "}of {sampleSize.toLocaleString()}
          {thin ? " — too few to read much into" : ""}
        </span>
      )}
    </p>
  );
}
