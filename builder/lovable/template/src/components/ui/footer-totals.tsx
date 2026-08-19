import { cn } from "@/lib/utils";
/**
 * The sums at the bottom of a table.
 *
 * IT SAYS WHAT IT IS TOTALLING. A row of numbers under a filtered table is
 * ambiguous between "these rows" and "everything", and the two differ by orders
 * of magnitude — an accounts screen where that is unclear is one nobody can
 * rely on.
 *
 * In a real `<tfoot>`, which belongs immediately after `<thead>` in the source
 * for older assistive technology and is placed at the bottom visually by the
 * browser. It is also what makes the totals repeat on each page when printed.
 *
 * Cells align right with `tabular-nums`, matching the columns they sum — a total
 * that does not line up with its column is a total the eye cannot attach to
 * anything.
 */
export function FooterTotals({ label = "Total", cells, scope, className }: {
  label?: string;
  /** One per column, aligned with the body. Null renders an empty cell. */
  cells: (React.ReactNode | null)[];
  /** What is being summed — "the 412 filtered rows". */
  scope?: string;
  className?: string;
}) {
  return (
    <tfoot className={cn("border-t border-border font-medium", className)}>
      <tr>
        <th scope="row" className="px-3 py-2 text-start text-sm">
          {label}
          {scope && <span className="block text-xs font-normal text-muted-foreground">{scope}</span>}
        </th>
        {cells.map((c, i) => (
          <td key={i} className="px-3 py-2 text-end text-sm tabular-nums">{c}</td>
        ))}
      </tr>
    </tfoot>
  );
}
