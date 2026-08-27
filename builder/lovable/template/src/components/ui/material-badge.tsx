import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * What it is made of, as a composition that adds to 100%.
 *
 * THE PERCENTAGES ARE CHECKED AND THE SHORTFALL IS SHOWN. "80% cotton" with
 * nothing else listed is the commonest data error in a catalogue, and a
 * component that renders it silently is how it reaches the customer. If the
 * parts do not sum to 100, the gap is stated rather than hidden.
 *
 * ORDERED BY SHARE, largest first, because that is how a label is read and
 * how the dominant material gets found at a glance.
 */
export function MaterialBadge({ parts, className }: {
  parts: { material: string; percent: number }[];
  className?: string;
}) {
  const sorted = [...parts].sort((a, b) => b.percent - a.percent);
  const sum = sorted.reduce((s, p) => s + p.percent, 0);
  return (
    <p data-slot="material-badge" className={cn("text-xs", className)}>
      {sorted.map((p, i) => (
        <span key={p.material}>
          {i > 0 ? ", " : ""}
          <span className="tabular-nums">{p.percent}%</span> {p.material}
        </span>
      ))}
      {sum !== 100 ? (
        <span className="text-muted-foreground"> · {sum < 100 ? `${100 - sum}% not stated` : "adds to over 100% — check the data"}</span>
      ) : null}
    </p>
  );
}
