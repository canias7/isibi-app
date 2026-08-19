import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The totals row at the bottom of a table.
 *
 * It says WHAT it totalled. "£4,210" under a filtered table is ambiguous
 * between the page, the filter and everything — three different numbers, and
 * the reader cannot tell which they are looking at. So the scope is printed
 * next to it: "Total (24 shown)" versus "Total (all 1,340)".
 *
 * A real `<tfoot>`, which browsers and print stylesheets treat as a footer and
 * screen readers announce as one; a final `<tr>` in the body is just another
 * row and gets sorted, striped and selected along with the data.
 */
export function FooterSummary({ cells, scope, sticky, className }: {
  cells: { key: string; value?: React.ReactNode; label?: React.ReactNode; align?: "left" | "right"; span?: number }[];
  scope?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <tfoot className={cn("border-t-2 border-border bg-muted/50 text-sm font-semibold",
      sticky && "sticky bottom-0", className)}>
      <tr>
        {cells.map((c) => (
          <td key={c.key} colSpan={c.span}
            className={cn("px-3 py-2", c.align === "right" ? "text-end tabular-nums" : "text-start")}>
            {c.label ? (
              <span className="block text-[11px] font-normal text-muted-foreground">{c.label}</span>
            ) : null}
            {c.value}
          </td>
        ))}
      </tr>
      {scope ? (
        <tr>
          <td colSpan={cells.reduce((n, c) => n + (c.span ?? 1), 0)}
            className="px-3 pb-2 text-[11px] font-normal text-muted-foreground">
            {scope}
          </td>
        </tr>
      ) : null}
    </tfoot>
  );
}
