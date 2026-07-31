import * as React from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * The per-column filter that lives in a table header.
 *
 * The trigger says WHETHER it is filtering, from the icon alone — a filled
 * marker and the count of chosen values. A filter that looks identical whether
 * it is on or off is how somebody concludes their rows have vanished; it is the
 * same failure `filter-bar` exists to prevent, one column down.
 *
 * Values are counted, so the list reads "Saturday (14)". Without the counts the
 * list is a set of names and choosing between them is guesswork.
 *
 * "All" is a real control, not the absence of ticks: unticking the last box is
 * indistinguishable from an empty list, and clearing has to be one action.
 */
export function ColumnFilter({ label, values, selected, onChange, counts, className }: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  counts?: Record<string, number>;
  className?: string;
}) {
  const on = selected.length > 0;
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button"
          aria-label={on ? `Filter ${label}: ${selected.length} chosen` : `Filter ${label}`}
          className={cn("inline-flex cursor-pointer items-center gap-1 rounded p-1 text-xs",
            on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            className)}>
          <Filter aria-hidden className={cn("size-3.5", on && "fill-current")} />
          {on ? <span className="tabular-nums">{selected.length}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium">{label}</span>
          <button type="button" onClick={() => onChange([])} disabled={!on}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
            All
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {values.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No values.</p>
          ) : values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={selected.includes(v)} onCheckedChange={() => toggle(v)} />
              <span className="min-w-0 flex-1 truncate">{v}</span>
              {counts?.[v] != null ? (
                <span className="text-xs text-muted-foreground tabular-nums">{counts[v]}</span>
              ) : null}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The distinct values of one column, with how many rows carry each. */
export function columnValues<T>(rows: T[], pick: (row: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const v = pick(row);
    if (v == null || v === "") continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return { values: Object.keys(counts).sort((a, b) => a.localeCompare(b)), counts };
}
