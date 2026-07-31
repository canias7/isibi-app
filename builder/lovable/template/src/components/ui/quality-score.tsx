import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Data health as CHECKS, not a number — trust-score's rule for datasets.
 *
 * THERE IS NO `score` PROP, for the same three reasons trust-score
 * refuses one: an opaque 82/100 cannot be explained, cannot be argued
 * with, and optimising it becomes the job. What exists is a list of
 * named checks with pass/fail and a one-line consequence for each
 * failure — the tick-and-dash convention (comparison-table), never
 * colour.
 *
 * THE HEADLINE IS THE FAILING COUNT ("2 checks failing"), because the
 * passing ones are not the news. All passing collapses to one quiet
 * line — done reads as done (the completeness-bar rule).
 */
export function QualityScore({ checks, className }: {
  checks: { label: string; pass: boolean; consequence?: React.ReactNode }[];
  className?: string;
}) {
  const failing = checks.filter((c) => !c.pass);
  if (!failing.length) {
    return <p className={cn("text-xs text-muted-foreground", className)}>All {checks.length} data checks passing.</p>;
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-sm font-semibold">{failing.length} of {checks.length} checks failing</p>
      <ul className="flex flex-col gap-1">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            {c.pass
              ? <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              : <Minus className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            <span className={cn(!c.pass && "font-medium")}>
              {c.label}
              <span className="sr-only">{c.pass ? " — passing" : " — failing"}</span>
              {!c.pass && c.consequence ? (
                <span className="block text-xs font-normal text-muted-foreground">{c.consequence}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
