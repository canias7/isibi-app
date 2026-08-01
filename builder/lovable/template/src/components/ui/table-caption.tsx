import { cn } from "@/lib/utils";
/**
 * What the table is, and how much of it you are looking at.
 *
 * A REAL `<caption>`, which is the accessible name of the table — a screen
 * reader announces it on entry, so "Bookings, 412 rows, filtered to March" is
 * the difference between knowing where you are and landing in a grid of numbers.
 * A heading above the table does not do this.
 *
 * IT STATES THE FILTERED COUNT AGAINST THE TOTAL. "412 of 3,000" is what stops
 * somebody concluding their data has vanished when a filter is still on — the
 * commonest false alarm in any table.
 *
 * `caption-side: top` because the default in some engines is the bottom, where
 * it is read last and helps nobody.
 */
export function TableCaption({ children, shown, total, filtered, className }: {
  children: React.ReactNode;
  shown?: number; total?: number;
  /** Narrowed by a filter. */
  filtered?: boolean;
  className?: string;
}) {
  return (
    <caption className={cn("caption-top pb-2 text-left text-sm text-muted-foreground", className)}>
      <span className="font-medium text-foreground">{children}</span>
      {typeof shown === "number" && (
        <span className="tabular-nums">
          {" · "}{shown.toLocaleString()}
          {typeof total === "number" && total !== shown ? ` of ${total.toLocaleString()}` : ""} rows
          {filtered ? " (filtered)" : ""}
        </span>
      )}
    </caption>
  );
}
