import * as React from "react";
import { Plus, X, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Building a multi-column sort as a list of rules — the editor for what
 * `multi-sort` displays.
 *
 * THE ORDER OF THE RULES IS THE PRECEDENCE, and it can be changed with buttons.
 * "By date, then by barber" and "by barber, then by date" are different tables,
 * and a picker that can add rules but not reorder them makes getting the second
 * one a matter of deleting and re-adding in sequence.
 *
 * A COLUMN CANNOT BE ADDED TWICE. Sorting by price and then by price again is
 * meaningless, and the second rule silently does nothing — so the already-used
 * columns are removed from the choices rather than being offered and ignored.
 *
 * Each rule names its direction in WORDS appropriate to the type — "Newest
 * first" rather than "descending" for a date, "A to Z" for text. Ascending and
 * descending are correct and are not how anybody thinks about a date column.
 *
 * The whole sort is restated in a sentence underneath, like `query-builder`.
 */
export type SortColumn = { key: string; label: string; type?: "text" | "number" | "date" };
export type SortRule = { key: string; dir: "asc" | "desc" };

export function directionLabel(type: SortColumn["type"], dir: "asc" | "desc") {
  if (type === "date") return dir === "asc" ? "Oldest first" : "Newest first";
  if (type === "number") return dir === "asc" ? "Lowest first" : "Highest first";
  return dir === "asc" ? "A to Z" : "Z to A";
}

export function MultiSortPicker({ columns, rules, onChange, className }: {
  columns: SortColumn[];
  rules: SortRule[];
  onChange: (next: SortRule[]) => void;
  className?: string;
}) {
  // Already-used columns are not offered: a repeat rule silently does nothing.
  const free = columns.filter((c) => !rules.some((r) => r.key === c.key));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rules.length) return;
    const next = rules.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rules.map((r, i) => {
        const col = columns.find((c) => c.key === r.key);
        return (
          <div key={r.key} className="flex flex-wrap items-center gap-1.5">
            <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate text-sm">{col?.label ?? r.key}</span>
            <select value={r.dir} aria-label={`Direction for ${col?.label ?? r.key}`}
              onChange={(e) => onChange(rules.map((x, k) => (k === i ? { ...x, dir: e.target.value as "asc" | "desc" } : x)))}
              className="h-7 cursor-pointer rounded border border-border bg-background px-1.5 text-xs">
              <option value="asc">{directionLabel(col?.type, "asc")}</option>
              <option value="desc">{directionLabel(col?.type, "desc")}</option>
            </select>
            {r.dir === "asc"
              ? <ArrowUp aria-hidden className="size-3 text-muted-foreground" />
              : <ArrowDown aria-hidden className="size-3 text-muted-foreground" />}
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              aria-label={`Move ${col?.label ?? r.key} earlier`}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
              <ChevronUp aria-hidden className="size-3.5" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rules.length - 1}
              aria-label={`Move ${col?.label ?? r.key} later`}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
            <button type="button" onClick={() => onChange(rules.filter((_, k) => k !== i))}
              aria-label={`Stop sorting by ${col?.label ?? r.key}`}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        );
      })}
      {free.length ? (
        <div className="flex items-center gap-1.5">
          <Plus aria-hidden className="size-3 text-muted-foreground" />
          <select value="" aria-label="Add a sort column"
            onChange={(e) => { if (e.target.value) onChange([...rules, { key: e.target.value, dir: "asc" }]); }}
            className="h-7 cursor-pointer rounded border border-border bg-background px-1.5 text-xs">
            <option value="">Add a column…</option>
            {free.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {rules.length === 0 ? "No sorting — the default order." : (
          <>Sorted by{" "}
            {rules.map((r, i) => {
              const col = columns.find((c) => c.key === r.key);
              return (
                <React.Fragment key={r.key}>
                  {i > 0 ? ", then " : ""}
                  <strong className="font-medium text-foreground">
                    {col?.label ?? r.key} ({directionLabel(col?.type, r.dir).toLowerCase()})
                  </strong>
                </React.Fragment>
              );
            })}.
          </>
        )}
      </p>
    </div>
  );
}
