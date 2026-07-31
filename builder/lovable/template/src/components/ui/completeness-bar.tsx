import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * How filled-in a record is — with the gaps NAMED.
 *
 * A BAR ALONE IS A NAG; THE NAMES ARE THE TO-DO. "60% complete" gives
 * somebody nothing to do next; "missing: photo, price" is the work
 * itself. The bar takes `fields` as {label, filled} pairs so the missing
 * names fall out of the same data the fraction does — they cannot
 * disagree.
 *
 * COUNTS RIDE THE BAR ("4 of 6"), the percent is not printed at all —
 * with six fields, "67%" is theatre (the poll-result rule).
 *
 * 100% RENDERS ONE QUIET LINE and no bar. A full bar demanding attention
 * for a finished job is the checklist-dot failure; done should read as
 * done.
 */
export function CompletenessBar({ fields, className }: {
  fields: { label: string; filled: boolean }[];
  className?: string;
}) {
  const done = fields.filter((f) => f.filled).length;
  const missing = fields.filter((f) => !f.filled).map((f) => f.label);
  if (!missing.length) {
    return <p className={cn("text-xs text-muted-foreground", className)}>Complete — all {fields.length} fields filled.</p>;
  }
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">{done} of {fields.length} filled</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ width: `${(done / fields.length) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">Missing: {missing.join(", ")}.</p>
    </div>
  );
}
