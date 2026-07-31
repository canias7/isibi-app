import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The tiny setup-progress ring worn by a "Getting started" nav item.
 *
 * IT DISAPPEARS WHEN COMPLETE — the completion-ring rule at nav size. A
 * finished checklist still showing 5/5 is a chore that will not admit it
 * is over; absence is the reward, and the nav item goes back to being a
 * plain link (or the caller removes it entirely).
 *
 * THE COUNT RIDES BESIDE THE RING. A ring alone at 12px cannot be read to
 * the step ("is that 3/5 or 4/5?") — the fraction is the information, the
 * ring is the shape that says "progress" at a glance.
 *
 * Plain SVG (the progress-ring rule: not a chart library for one arc),
 * monochrome, sr-only words for the whole claim.
 */
export function ChecklistDot({ done, total, className }: {
  done: number;
  total: number;
  className?: string;
}) {
  const n = Math.max(0, Math.min(done, total));
  if (total <= 0 || n >= total) return null;
  const r = 5, c = 2 * Math.PI * r;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <svg viewBox="0 0 14 14" className="size-3.5 -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={c * (1 - n / total)} strokeLinecap="round" />
      </svg>
      <span className="text-[11px] tabular-nums text-muted-foreground" aria-hidden>{n}/{total}</span>
      <span className="sr-only">{n} of {total} setup steps done</span>
    </span>
  );
}
