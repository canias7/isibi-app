import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A two-sided tally in one bar.
 *
 * BOTH COUNTS ARE PRINTED AT THEIR OWN ENDS — the split alone answers
 * "which side is winning" and hides "by how many people", and with tallies
 * the second question is the one that matters.
 *
 * SMALL SAMPLES SAY SO. A 100/0 split with three votes renders as certainty
 * and is noise; below `smallBelow` (default 10) a caption says "early days"
 * so the bar cannot overclaim. This is the poll version of range-summary's
 * "typically".
 *
 * One side is ink, the other is the muted track with a border between — the
 * split reads by GEOMETRY (where the boundary sits), which survives
 * greyscale by construction. Zero total renders an even, empty bar with
 * "no votes yet" — never a division error.
 */
export function VoteBar({ a, b, smallBelow = 10, className }: {
  a: { label: string; votes: number };
  b: { label: string; votes: number };
  smallBelow?: number;
  className?: string;
}) {
  const total = a.votes + b.votes;
  const pctA = total ? Math.round((a.votes / total) * 100) : 50;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{a.label} <span className="tabular-nums text-xs text-muted-foreground">{a.votes}</span></span>
        <span className="font-medium"><span className="tabular-nums text-xs text-muted-foreground">{b.votes}</span> {b.label}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full border border-border bg-muted">
        <div className={cn("h-full", total > 0 && "bg-foreground")} style={{ width: `${pctA}%` }} />
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {total === 0 ? "No votes yet"
          : total < smallBelow ? `Only ${total} vote${total === 1 ? "" : "s"} so far — early days.`
          : `${total} votes`}
      </p>
    </div>
  );
}
