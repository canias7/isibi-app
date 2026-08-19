import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OverflowScroller } from "@/components/ui/overflow-scroller";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  /** Defaults to reading `row[key]`. */
  cell?: (row: T) => React.ReactNode;
  numeric?: boolean;
  width?: string;
};

/**
 * A table from columns and rows, rather than hand-written markup per site.
 *
 * Scrolls inside itself on narrow screens — a table is the most common reason a
 * page body ends up scrolling sideways.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns, rows, empty = "Nothing here yet", rowKey, onRowClick, className,
}: {
  columns: Column<T>[]; rows: T[]; empty?: string;
  rowKey?: (row: T, i: number) => string | number;
  onRowClick?: (row: T) => void; className?: string;
}) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <OverflowScroller className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} style={c.width ? { width: c.width } : undefined}
                className={cn(c.numeric && "text-end")}>{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={rowKey ? rowKey(r, i) : i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn(onRowClick && "cursor-pointer")}>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn(c.numeric && "text-end tabular-nums")}>
                  {c.cell ? c.cell(r) : String(r[c.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </OverflowScroller>
  );
}
