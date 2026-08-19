import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The filter box above a long navigation menu.
 *
 * IT KEEPS A MATCHED ITEM'S PARENTS VISIBLE. Filtering a tree by matching leaf
 * names alone strips the headings, so the result is a flat list of items with
 * no indication which section each belongs to — and in a settings menu the
 * section is half the meaning.
 *
 * NO RESULTS IS A REAL MESSAGE naming the query, and it offers to clear. An
 * empty menu with a full search box is the state people read as broken.
 *
 * It filters on the CLIENT and says so implicitly by being instant. This is for
 * a menu of tens of items; a menu of thousands wants `command-bar` and a real
 * search.
 *
 * Escape clears rather than closing anything, because this box is part of the
 * menu rather than a layer over it — and a keystroke that empties the filter is
 * the one people reach for.
 */
/**
 * The shape a nav tree has to have. It is a STANDALONE recursive type rather
 * than a self-referential generic constraint (`T extends {children?: T[]}`),
 * because that constraint is unsatisfiable for a literal: TypeScript infers `T`
 * from the outer element, which HAS children, and then demands the inner nodes
 * have children too. The natural call site does not compile — measured.
 */
export type NavNode = { label: string; children?: NavNode[] };

export function filterNavTree<T extends NavNode>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const walk = (list: T[]): T[] =>
    list
      .map((item) => {
        const kids = item.children ? walk(item.children as T[]) : undefined;
        const hit = item.label.toLowerCase().includes(q);
        // A parent survives if it matches OR if anything under it does.
        if (!hit && !(kids && kids.length)) return null;
        return { ...item, children: hit ? item.children : kids } as T;
      })
      .filter((x): x is T => x !== null);
  return walk(items);
}

export function NavSearch({ value, onChange, count, placeholder = "Filter", className }: {
  value: string;
  onChange: (next: string) => void;
  count?: number;
  placeholder?: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 start-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} aria-label={placeholder}
          onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); e.stopPropagation(); onChange(""); } }}
          className="h-8 w-full rounded-md border border-border bg-background pe-2 ps-7 text-xs outline-none focus-visible:border-ring" />
      </div>
      {value && count === 0 ? (
        <p aria-live="polite" className="px-1 text-xs text-muted-foreground">
          Nothing matches &ldquo;{value}&rdquo;.{" "}
          <button type="button" onClick={() => onChange("")}
            className="cursor-pointer underline underline-offset-2 hover:text-foreground">Clear</button>
        </p>
      ) : null}
    </div>
  );
}
