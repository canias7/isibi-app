import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Count · sum · average · min · max — over which column.
 *
 * COUNT NEEDS NO COLUMN, AND THE COLUMN SELECT SAYS SO by disabling with
 * "every row" shown in it — count-of-rows is the question people mean
 * first, and pairing it with a meaningless column choice invites "count
 * of price" readings that do not exist.
 *
 * THE PAIR IS ONE DECISION: fn + column emit together, because "sum" with
 * last week's column selection is a silent wrong answer. Averages of
 * money round to the CALLER's formatting — this picker never computes,
 * it only names the computation, which keeps it honest about what it is.
 */
export const AGGREGATES = [
  { key: "count", label: "Count", needsColumn: false },
  { key: "sum", label: "Sum", needsColumn: true },
  { key: "avg", label: "Average", needsColumn: true },
  { key: "min", label: "Min", needsColumn: true },
  { key: "max", label: "Max", needsColumn: true },
] as const;

export function AggregatePicker({ columns, fn, column, onChange, className }: {
  columns: { key: string; label: string }[];
  fn: string;
  column?: string;
  onChange: (v: { fn: string; column?: string }) => void;
  className?: string;
}) {
  const needsColumn = AGGREGATES.find((a) => a.key === fn)?.needsColumn ?? true;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <select value={fn} aria-label="Calculation"
        onChange={(e) => {
          const nf = e.target.value;
          const needs = AGGREGATES.find((a) => a.key === nf)?.needsColumn;
          onChange({ fn: nf, column: needs ? (column ?? columns[0]?.key) : undefined });
        }}
        className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {AGGREGATES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
      </select>
      <span className="text-xs text-muted-foreground">of</span>
      <select value={needsColumn ? (column ?? "") : ""} disabled={!needsColumn} aria-label="Column"
        onChange={(e) => onChange({ fn, column: e.target.value })}
        className="h-7 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground">
        {!needsColumn ? <option value="">every row</option> : null}
        {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
    </div>
  );
}
