import { cn } from "@/lib/utils";
/**
 * How a total score was arrived at, line by line.
 *
 * A SCORE WITH NO BREAKDOWN IS UNARGUABLE, which is the problem. Anybody scored
 * by a system — a supplier, a candidate, a loan applicant — reasonably wants to
 * know which part cost them, and "72/100" answers nothing and appeals nothing.
 *
 * Each line shows its own score AND its weight, because a component scoring 2/10
 * matters enormously at 40% weight and barely at all at 4% — and without the
 * weight the reader cannot tell which line to argue with.
 *
 * The total is recomputed here from the lines rather than taken as a prop, so a
 * breakdown can never disagree with the headline it is explaining. That
 * disagreement is exactly what destroys trust in a scoring screen.
 */
export type ScoreLine = { label: string; score: number; outOf: number; weight?: number; note?: string };

export function ScoreBreakdown({ lines, className }: {
  lines: ScoreLine[];
  className?: string;
}) {
  if (!lines.length) return null;
  const weighted = lines.some((l) => typeof l.weight === "number");
  const total = weighted
    // `outOf` of 0 is an unfilled or not-applicable criterion, and it is the
    // ordinary state of a half-filled rubric. Undivided it yields Infinity or
    // NaN, which propagates through the sum and renders the TOTAL — the one
    // number anybody reads — as "NaN".
    ? lines.reduce((s, l) => s + (l.outOf > 0 ? l.score / l.outOf : 0) * (l.weight ?? 0), 0)
    : lines.reduce((s, l) => s + l.score, 0);
  const outOf = weighted ? lines.reduce((s, l) => s + (l.weight ?? 0), 0) : lines.reduce((s, l) => s + l.outOf, 0);
  return (
    <div data-slot="score-breakdown" className={cn("flex flex-col gap-2", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {lines.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              {l.label}
              {typeof l.weight === "number" && (
                <span className="text-muted-foreground tabular-nums"> · {l.weight}% of the total</span>
              )}
              {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{l.score} / {l.outOf}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium tabular-nums">
        Total {Math.round(total * 10) / 10} / {Math.round(outOf * 10) / 10}
      </p>
    </div>
  );
}
