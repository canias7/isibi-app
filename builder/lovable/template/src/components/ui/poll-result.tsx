import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Poll results — bars, counts, and the total.
 *
 * COUNTS ARE THE GROUND TRUTH AND ALWAYS PRINTED; the percentage is derived
 * decoration. "67%" of three votes and of three thousand are different facts
 * wearing the same number, so the total is stated under the bars, always.
 *
 * THE LEADER IS BOLD — weight, not colour (ties: all leaders bold). The bar
 * fill is ink on a muted track, so the longest bar reads as such in
 * greyscale, print, and to everyone.
 *
 * THE VIEWER'S OWN CHOICE IS MARKED IN WORDS ("your vote"), because the
 * first thing anyone looks for in a poll they answered is themselves.
 *
 * Zero votes renders honestly: empty tracks and "No votes yet", not a
 * division error and not 0% pretending to be data.
 */
export function PollResult({ options, mine, className }: {
  options: { key: string; label: string; votes: number }[];
  mine?: string;
  className?: string;
}) {
  const total = options.reduce((s, o) => s + o.votes, 0);
  const top = Math.max(...options.map((o) => o.votes));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {options.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        const lead = total > 0 && o.votes === top;
        return (
          <div key={o.key} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn("min-w-0 truncate", lead && "font-semibold")}>
                {o.label}
                {mine === o.key ? <span className="ms-1.5 text-[11px] text-muted-foreground">(your vote)</span> : null}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {o.votes} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {total === 0 ? "No votes yet" : `${total} vote${total === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
