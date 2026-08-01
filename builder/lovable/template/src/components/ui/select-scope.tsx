import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * What "select all" is going to mean this time.
 *
 * Three answers, and the reader picks: the page in view, everything matching
 * the current filter, or everything there is. `bulk-actions` states the count
 * it is about to act on; this is the control that DECIDES that count, and on a
 * filtered list the difference between "the 40 I filtered to" and "all 12,000"
 * is the difference between a tidy-up and an incident.
 *
 * EVERY OPTION CARRIES ITS NUMBER. "Everything" is not a scope anybody can
 * assess, and the number is the entire reason to choose one option over
 * another.
 *
 * A real `radiogroup`: these are mutually exclusive readings of one action, so
 * arrow keys move between them and a screen reader announces "2 of 3". Three
 * separate buttons would imply three separate actions.
 *
 * "Matching the filter" is dropped when nothing is filtered, rather than shown
 * with the same number as "everything" — two identical options is a choice
 * nobody can make correctly.
 */
export type Scope = "page" | "filtered" | "all";

export function SelectScope({ value, onChange, pageCount, filteredCount, allCount, className }: {
  value: Scope;
  onChange: (scope: Scope) => void;
  pageCount: number;
  /** Omit when no filter is applied. */
  filteredCount?: number;
  allCount: number;
  className?: string;
}) {
  const id = React.useId();
  const options: { key: Scope; label: string; n: number }[] = [
    { key: "page", label: "This page", n: pageCount },
    ...(typeof filteredCount === "number" && filteredCount !== allCount
      ? [{ key: "filtered" as const, label: "Matching the filter", n: filteredCount }]
      : []),
    { key: "all", label: "Everything", n: allCount },
  ];

  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="text-sm font-medium">Apply to</legend>
      <div role="radiogroup" aria-label="Apply to" className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.key} htmlFor={`${id}-${o.key}`}
            className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
              value === o.key ? "border-foreground font-medium" : "border-border")}>
            <input type="radio" id={`${id}-${o.key}`} name={id} value={o.key}
              checked={value === o.key} onChange={() => onChange(o.key)}
              className="size-3.5 accent-foreground" />
            {o.label}
            <span className="text-muted-foreground tabular-nums">{o.n.toLocaleString()}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
