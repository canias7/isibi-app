import { cn } from "@/lib/utils";
/**
 * The first few rows, as they will actually be imported.
 *
 * Shown AFTER mapping and before committing — that order is the point. A
 * preview of the raw file proves the file was read; a preview of the mapped
 * result proves the columns went where they were meant to, which is the
 * mistake that is expensive to find later.
 *
 * The count of rows NOT shown is stated, so nobody reads five good rows as
 * four hundred good rows.
 */
export function ImportPreview({ columns, rows, total, className }: {
  columns: string[]; rows: Record<string, string>[]; total?: number; className?: string;
}) {
  const hidden = total != null ? Math.max(0, total - rows.length) : 0;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {columns.map((c) => (
                  <td key={c} className="max-w-48 truncate px-3 py-2">
                    {r[c] || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {total != null
          ? <>Showing {rows.length} of <strong className="text-foreground tabular-nums">{total.toLocaleString()}</strong> rows
              {hidden > 0 ? ` — ${hidden.toLocaleString()} more will be imported.` : "."}</>
          : `Showing ${rows.length} rows.`}
      </p>
    </div>
  );
}
