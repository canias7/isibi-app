import { cn } from "@/lib/utils";
/**
 * Working, but not properly.
 *
 * THE STATE BETWEEN UP AND DOWN, which almost nothing reports. Search is stale,
 * images are not loading, payments are slow — the site works, so no outage
 * banner fires, and the reader is left thinking they are doing something wrong.
 *
 * IT SAYS WHAT TO EXPECT rather than that something is wrong. "Results may be up
 * to an hour old" is actionable; "degraded performance" is a phrase from a
 * status page that tells a customer nothing.
 *
 * Deliberately quiet — a bordered line, not a filled banner. Degradation lasts
 * hours, and something loud enough for an outage becomes furniture in twenty
 * minutes and is then unnoticed when it matters.
 */
export function DegradedNote({ what, expect, since, className }: {
  /** The affected thing — "Search". */
  what: string;
  /** What the reader should expect — "results may be up to an hour old". */
  expect: string;
  since?: string;
  className?: string;
}) {
  return (
    <p data-slot="degraded-note" role="status" className={cn("rounded-md border border-border px-3 py-2 text-sm", className)}>
      <span className="font-medium">{what} is running slowly</span>
      <span className="text-muted-foreground"> — {expect}{since ? ` · since ${since}` : ""}</span>
    </p>
  );
}
