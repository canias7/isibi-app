import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A section heading inside a table body — "March", "Overdue", "Unassigned".
 *
 * A `<th scope="colgroup">` rather than a styled `<td>`, so a screen reader
 * announces the group each following row belongs to instead of reading the
 * month as if it were data.
 */
export function GroupedRows({ label, count, colSpan, children, className }: {
  label: string; count?: number; colSpan: number;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <>
      <tr className={cn("bg-muted/50", className)}>
        <th scope="colgroup" colSpan={colSpan}
          className="px-2 py-1.5 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {count != null && <span className="ms-2 font-normal tabular-nums">{count}</span>}
        </th>
      </tr>
      {children}
    </>
  );
}
