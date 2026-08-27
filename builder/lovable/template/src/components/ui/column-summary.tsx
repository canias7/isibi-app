import { cn } from "@/lib/utils";
/**
 * A one-line summary under a column heading.
 *
 * THE SHAPE OF A COLUMN AT A GLANCE — the range of a number column, how many
 * values a category column has, how many rows are blank. It is the thing people
 * scroll a thousand rows to work out.
 *
 * BLANKS ARE COUNTED SEPARATELY AND ALWAYS SHOWN when there are any. An average
 * computed over a column that is 40% empty is misleading, and the count is the
 * only thing that reveals it.
 *
 * Small and muted, sitting under the heading rather than in a panel — a summary
 * that has to be opened is one nobody opens, and the whole value is that it is
 * already there.
 */
export function ColumnSummary({ summary, blanks, total, className }: {
  /** "£12 – £2,650" or "8 values". */
  summary: string;
  blanks?: number;
  total?: number;
  className?: string;
}) {
  return (
    <span data-slot="column-summary" className={cn("block text-xs font-normal text-muted-foreground tabular-nums", className)}>
      {summary}
      {typeof blanks === "number" && blanks > 0 && (
        <> · {blanks}{typeof total === "number" ? `/${total}` : ""} blank</>
      )}
    </span>
  );
}
