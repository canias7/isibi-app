import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Group by: none · barber · service · day.
 *
 * "NONE" IS A FIRST-CLASS OPTION, first in the row. The flat list is the
 * default way to read data, not a grouping that failed to happen — pickers
 * that only offer ways to group leave no way back, and the person ends up
 * reloading the page to un-group.
 *
 * A row of chips, not a dropdown: grouping choices are few (this
 * component's premise — with ten ways to group you have a pivot table
 * problem, see pivot-table), and seeing them all costs one line while a
 * dropdown hides the current choice's alternatives.
 */
export function GroupByPicker({ options, value = "", onChange, className }: {
  options: { key: string; label: string }[];
  /** "" is ungrouped - the first-class flat list. */
  value?: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const all = [{ key: "", label: "None" }, ...options];
  return (
    <div role="group" aria-label="Group by" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">Group by</span>
      {all.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs",
            value === o.key ? "border-foreground bg-foreground font-medium text-background" : "border-border hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
