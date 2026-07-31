import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Stages, with what was LOST between them as the thing being read.
 *
 * `steps` AND `progress-stack` SHOW WHERE YOU ARE. A funnel is the opposite
 * question — of the people who reached step 2, how many never reached step
 * 3 — and the drop is rendered BETWEEN the bars rather than left as
 * arithmetic for the reader, because the gap is the finding.
 *
 * TWO PERCENTAGES, LABELLED, BECAUSE THEY DIFFER AND BOTH MATTER: share of
 * the top of the funnel, and share of the step immediately before. A funnel
 * showing only one is the classic misread — 5% overall can be a 90% step.
 *
 * COUNTS ARE ALWAYS PRINTED (the poll-result rule): "40% dropped" over 5
 * people and over 5000 are not the same fact.
 *
 * Bars are proportional to the top step, so a healthy funnel visibly barely
 * narrows — the shape is the summary.
 */
export function FunnelSteps({ steps, className }: {
  steps: { key: string; label: React.ReactNode; count: number }[];
  className?: string;
}) {
  const top = steps[0]?.count ?? 0;
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const lost = prev == null ? 0 : prev - s.count;
        const ofTop = top ? Math.round((s.count / top) * 100) : 0;
        const ofPrev = prev ? Math.round((s.count / prev) * 100) : 100;
        return (
          <li key={s.key}>
            {prev != null ? (
              <div className="flex items-center gap-2 py-1 pl-3 text-[11px] text-muted-foreground">
                <span aria-hidden className="h-4 border-l border-dashed border-border" />
                <span className="tabular-nums">
                  {lost > 0 ? <>−{lost.toLocaleString()} dropped here</> : <>no drop</>}
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <div className="h-7 flex-1 overflow-hidden rounded bg-muted">
                <div className="flex h-full items-center rounded bg-foreground pl-2 text-[11px] font-medium text-background"
                  style={{ width: `${Math.max(6, ofTop)}%` }}>
                  {s.label}
                </div>
              </div>
              <span className="w-36 shrink-0 text-right text-[11px] tabular-nums">
                <b>{s.count.toLocaleString()}</b>
                <span className="text-muted-foreground">
                  {" "}· {ofTop}% of start{i > 0 ? ` · ${ofPrev}% of previous` : ""}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
