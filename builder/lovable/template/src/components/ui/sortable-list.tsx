import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A list the reader can re-SORT — which is a different thing from `drag-list`,
 * where they re-ORDER it themselves.
 *
 * The distinction is worth keeping straight because they are constantly
 * confused: sorting is a view of the same data and is not saved; dragging
 * changes the data and is. A component that lets somebody drag rows in a sorted
 * list produces an order that vanishes on the next render, which is the bug
 * that follows from mixing them.
 *
 * The CURRENT SORT IS STATED IN WORDS — "Newest first" — not left to an arrow
 * on a column header. An arrow says a direction and not what it is a direction
 * of, and on a card list there is no header to put one on.
 *
 * Nulls go LAST whichever way it is sorted. An empty value is not the smallest
 * one, it is the absence of one, and reversing the sort to see the other end
 * should not fill the top with blanks. Same rule as `multi-sort`.
 *
 * Strings compare with `localeCompare` and `numeric`, so "Item 10" comes after
 * "Item 9" and "Ålesund" does not land after "Zurich".
 */
export type SortOption<T> = { key: string; label: string; get: (item: T) => unknown; desc?: boolean };

export function sortItems<T>(items: T[], option: SortOption<T> | undefined): T[] {
  if (!option) return items;
  return items.slice().sort((a, b) => {
    const av = option.get(a), bv = option.get(b);
    const ae = av == null || av === "", be = bv == null || bv === "";
    if (ae && be) return 0;
    if (ae) return 1;
    if (be) return -1;
    const n = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return option.desc ? -n : n;
  });
}

export function SortableList<T>({ options, value, onChange, count, className }: {
  options: SortOption<T>[];
  value: string;
  onChange: (key: string) => void;
  count?: number;
  className?: string;
}) {
  const id = React.useId();
  const current = options.find((o) => o.key === value);
  return (
    <div data-slot="sortable-list" className={cn("flex flex-wrap items-center gap-2", className)}>
      <ArrowUpDown aria-hidden className="size-3.5 text-muted-foreground" />
      <label htmlFor={id} className="sr-only">Sort</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring">
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {current ? current.label : null}
        {count != null ? <span className="tabular-nums"> · {count.toLocaleString()} shown</span> : null}
      </span>
    </div>
  );
}
