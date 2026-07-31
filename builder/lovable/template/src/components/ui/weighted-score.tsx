import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A total where the criteria carry different weights.
 *
 * THE WEIGHTS ARE NORMALISED AND THE NORMALISED SHARE IS SHOWN. People type
 * weights of 5, 3 and 2 and then read the total as if it were out of ten; the
 * displayed percentage is what makes "this criterion is half the decision"
 * visible before the total is believed.
 *
 * A ZERO-WEIGHT CRITERION IS STILL LISTED, greyed. Removing it hides that
 * somebody decided it does not matter — which is exactly the assumption a
 * reader of the decision should be able to challenge.
 *
 * IT SHOWS THE CONTRIBUTION PER CRITERION, not just the total. The useful
 * output of a weighted score is "it won on price and lost on support", and a
 * single number throws that away.
 *
 * If every weight is zero the total is undefined, not zero — stated as such
 * rather than rendering a confident 0.0.
 */
export function WeightedScore({ criteria, scale = 5, className }: {
  criteria: { key: string; label: React.ReactNode; weight: number; score?: number }[];
  scale?: number;
  className?: string;
}) {
  const totalWeight = criteria.reduce((n, c) => n + Math.max(0, c.weight), 0);
  const scored = criteria.filter((c) => typeof c.score === "number");
  const total = totalWeight > 0
    ? scored.reduce((n, c) => n + (c.score! / scale) * (Math.max(0, c.weight) / totalWeight), 0)
    : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col gap-1.5">
        {criteria.map((c) => {
          const share = totalWeight > 0 ? Math.max(0, c.weight) / totalWeight : 0;
          const contribution = typeof c.score === "number" ? (c.score / scale) * share : null;
          return (
            <li key={c.key} className={cn("flex items-baseline gap-2 text-sm", c.weight <= 0 && "text-muted-foreground")}>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {/* The normalised share, or the raw weights get read as a total. */}
              <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {Math.round(share * 100)}%
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {c.score ?? "—"}/{scale}
              </span>
              <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums">
                {contribution == null ? "—" : `+${(contribution * 100).toFixed(0)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border pt-2 text-sm">
        {total == null ? (
          <span className="text-muted-foreground">No total &mdash; every criterion has a weight of zero.</span>
        ) : (
          <>
            <strong className="font-semibold tabular-nums">{(total * 100).toFixed(0)}</strong>
            <span className="text-muted-foreground"> out of 100</span>
            {scored.length < criteria.length ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {" "}· {criteria.length - scored.length} not scored
              </span>
            ) : null}
          </>
        )}
      </p>
    </div>
  );
}
