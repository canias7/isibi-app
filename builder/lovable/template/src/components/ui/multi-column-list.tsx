import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A long list flowed into columns.
 *
 * CSS multi-column, which fills DOWN each column then across — so the reading
 * order matches the DOM order and a screen reader gets it right. A grid would
 * put item 2 at the top of column two, which reads correctly to a machine and
 * wrongly to a person scanning alphabetically.
 *
 * `break-inside-avoid` on each item, or a row splits across a column boundary
 * with its label in one column and its value in the next.
 */
export function MultiColumnList({ items, columns = 3, className }: {
  items: React.ReactNode[]; columns?: 2 | 3 | 4; className?: string;
}) {
  const cols = { 2: "sm:columns-2", 3: "sm:columns-2 lg:columns-3", 4: "sm:columns-2 lg:columns-4" }[columns];
  return (
    <ul className={cn("gap-x-8", cols, className)}>
      {items.map((it, i) => (
        <li key={i} className="mb-1.5 break-inside-avoid text-sm">{it}</li>
      ))}
    </ul>
  );
}
