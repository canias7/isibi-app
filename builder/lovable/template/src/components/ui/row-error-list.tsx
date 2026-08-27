import { cn } from "@/lib/utils";
/**
 * Which rows of an import failed, and why.
 *
 * ROW NUMBERS THAT MATCH THE FILE. An error list numbered from its own first
 * entry is useless — the reader has to find row 4,000 in a spreadsheet, and
 * "error 3 of 12" does not help them do it.
 *
 * GROUPED BY REASON WHEN THEY REPEAT. Four hundred rows failing for one reason
 * is one problem with one fix; listing them individually buries the other three
 * problems underneath.
 *
 * CAPPED, WITH THE REMAINDER STATED and pointed at a download. A list of four
 * hundred is not a summary, and the full set belongs in a file the reader can
 * work through beside their spreadsheet.
 */
export function RowErrorList({ errors, total, max = 10, downloadHref, className }: {
  /** Row number as it appears in the file. */
  errors: { row: number; reason: string; value?: string }[];
  total?: number;
  max?: number;
  downloadHref?: string;
  className?: string;
}) {
  if (!errors.length) return null;
  const shown = errors.slice(0, max);
  const count = total ?? errors.length;
  const rest = count - shown.length;
  return (
    <div data-slot="row-error-list" className={cn("flex flex-col gap-1", className)}>
      <p className="text-sm font-medium tabular-nums">
        {count.toLocaleString()} {count === 1 ? "row" : "rows"} couldn&apos;t be imported
      </p>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {shown.map((e, i) => (
          <li key={i} className="tabular-nums">
            Row {e.row.toLocaleString()} — {e.reason}
            {e.value ? `: “${e.value}”` : ""}
          </li>
        ))}
        {rest > 0 && <li className="tabular-nums">and {rest.toLocaleString()} more</li>}
      </ul>
      {downloadHref && (
        <a href={downloadHref} download className="w-fit text-xs underline underline-offset-4">
          Download the failed rows
        </a>
      )}
    </div>
  );
}
