import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The footer row of a table of numbers.
 *
 * Rendered in `<tfoot>` rather than as a last `<tbody>` row: a total that sorts
 * into the middle of the data when somebody clicks a column header is worse
 * than no total.
 */
export function TotalsRow({ label = "Total", cells, className }: {
  label?: string; cells: React.ReactNode[]; className?: string;
}) {
  return (
    <tfoot className={cn("border-t-2 border-border font-medium", className)}>
      <tr>
        <td className="py-2.5 pl-2 text-sm">{label}</td>
        {cells.map((c, i) => (
          <td key={i} className="py-2.5 pr-2 text-right text-sm tabular-nums">{c}</td>
        ))}
      </tr>
    </tfoot>
  );
}
