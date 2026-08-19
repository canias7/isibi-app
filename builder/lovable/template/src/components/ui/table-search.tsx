import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The search box over a table, and the matcher behind it.
 *
 * `useTableSearch` splits on spaces and requires EVERY word to appear
 * somewhere in the row — "ada sat" finds Ada's Saturday booking. Matching the
 * whole phrase against each field instead means a search spanning two columns
 * finds nothing, which is what people actually type into a table search.
 *
 * The result COUNT is announced with `aria-live`, because on a filtered table
 * the only feedback is rows disappearing, and somebody not looking at the table
 * gets no feedback at all.
 *
 * Clear is a real button rather than `type="search"`'s native cross: that one
 * is Chromium-only and invisible to a keyboard.
 */
export function useTableSearch<T>(rows: T[], query: string, fields: (row: T) => (string | number | null | undefined)[]) {
  return React.useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return rows;
    return rows.filter((row) => {
      const hay = fields(row).map((v) => (v == null ? "" : String(v).toLowerCase())).join(" ");
      return words.every((w) => hay.includes(w));
    });
  }, [rows, query, fields]);
}

export function TableSearch({ value, onChange, placeholder = "Search", count, total, className }: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  count?: number;
  total?: number;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); onChange(""); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-md border border-border bg-background pe-8 ps-8 text-sm outline-none focus-visible:border-ring"
        />
        {value ? (
          <button type="button" onClick={() => onChange("")} aria-label="Clear search"
            className="absolute top-1/2 end-2 cursor-pointer -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {value && count != null
          ? count === 0
            ? `No rows match "${value}".`
            : `${count.toLocaleString()} of ${(total ?? count).toLocaleString()} rows match.`
          : null}
      </p>
    </div>
  );
}
