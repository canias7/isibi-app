import * as React from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Sorting by more than one column, and showing that you are.
 *
 * The ORDER is numbered on screen. Multi-sort without visible precedence is
 * indistinguishable from a table sorted wrongly — "by date, then by barber" and
 * "by barber, then by date" are different tables and the reader cannot tell
 * which they have.
 *
 * `applySort` compares with `localeCompare` for strings so "Ålesund" does not
 * land after "Zurich", and pushes null and undefined to the END regardless of
 * direction: an empty cell is not the smallest value, it is the absence of one,
 * and reversing the sort to see the other end should not fill the top of the
 * table with blanks.
 */
export type SortRule = { key: string; dir: "asc" | "desc" };

export function toggleSort(rules: SortRule[], key: string, additive = false): SortRule[] {
  const at = rules.findIndex((r) => r.key === key);
  if (!additive) {
    if (at === 0 && rules.length === 1) return rules[0].dir === "asc" ? [{ key, dir: "desc" }] : [];
    return [{ key, dir: "asc" }];
  }
  if (at === -1) return [...rules, { key, dir: "asc" }];
  if (rules[at].dir === "asc") return rules.map((r, i) => (i === at ? { key, dir: "desc" as const } : r));
  return rules.filter((_, i) => i !== at);
}

export function applySort<T>(rows: T[], rules: SortRule[], get: (row: T, key: string) => unknown): T[] {
  if (rules.length === 0) return rows;
  return rows.slice().sort((a, b) => {
    for (const rule of rules) {
      const av = get(a, rule.key), bv = get(b, rule.key);
      const ae = av == null || av === "", be = bv == null || bv === "";
      if (ae && be) continue;
      if (ae) return 1;
      if (be) return -1;
      const n = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      if (n !== 0) return rule.dir === "asc" ? n : -n;
    }
    return 0;
  });
}

export function MultiSort({ rules, labels, onChange, className }: {
  rules: SortRule[];
  labels: Record<string, string>;
  onChange: (next: SortRule[]) => void;
  className?: string;
}) {
  if (rules.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}>
      <span className="text-muted-foreground">Sorted by</span>
      {rules.map((r, i) => (
        <span key={r.key} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2">
          {rules.length > 1 ? <span className="text-muted-foreground tabular-nums">{i + 1}.</span> : null}
          <span>{labels[r.key] ?? r.key}</span>
          <button type="button"
            onClick={() => onChange(rules.map((x, j) => (j === i ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}
            aria-label={`${labels[r.key] ?? r.key}: ${r.dir === "asc" ? "ascending" : "descending"}, change direction`}
            className="cursor-pointer rounded p-0.5 hover:bg-background">
            {r.dir === "asc"
              ? <ArrowUp aria-hidden className="size-3" />
              : <ArrowDown aria-hidden className="size-3" />}
          </button>
          <button type="button" onClick={() => onChange(rules.filter((_, j) => j !== i))}
            aria-label={`Stop sorting by ${labels[r.key] ?? r.key}`}
            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground">
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      {rules.length > 1 ? (
        <button type="button" onClick={() => onChange([])}
          className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Clear
        </button>
      ) : null}
    </div>
  );
}
