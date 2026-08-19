import { cn } from "@/lib/utils";
/**
 * The row's position, counted across pages.
 *
 * IT CONTINUES ACROSS PAGINATION. A table restarting at 1 on page two makes
 * "row 14" meaningless the moment two people are looking at different pages,
 * which is exactly when somebody says it aloud.
 *
 * `<th scope="row">` rather than a `<td>`, so a screen reader announces the
 * number as the row's label when reading any cell in it — the whole reason to
 * have the column.
 *
 * `tabular-nums` and right-aligned so a column of them lines up; proportional
 * digits make 9 and 10 sit at different offsets and the column looks ragged.
 */
export function RowNumber({ index, pageSize = 0, page = 0, className }: {
  /** Zero-based within the page. */
  index: number;
  pageSize?: number;
  /** Zero-based page. */
  page?: number;
  className?: string;
}) {
  return (
    <th scope="row" className={cn("px-3 py-2 text-end text-xs font-normal text-muted-foreground tabular-nums", className)}>
      {page * pageSize + index + 1}
    </th>
  );
}
