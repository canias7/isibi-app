import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Which way a column is sorted, said in the column's own words.
 *
 * "NEWEST FIRST" BEATS AN ARROW. An up arrow on a date column is genuinely
 * ambiguous — plenty of people read it as "going up in time", which is the
 * opposite of what it usually means — and the same arrow on a price column means
 * something different again. The words are per-column and come from the caller.
 *
 * `aria-sort` on the caller's `<th>` is what a screen reader reads; this
 * component carries the visible half and a matching `sr-only` phrase, so both
 * audiences get the same sentence rather than one getting an arrow glyph.
 *
 * A real button, since sorting is an action, and the arrow is aria-hidden
 * decoration beside the text.
 */
export function SortDirection({ direction, ascLabel = "A to Z", descLabel = "Z to A", onToggle, columnName, className }: {
  direction: "asc" | "desc" | null;
  /** What ascending means here — "Oldest first", "Cheapest first". */
  ascLabel?: string;
  descLabel?: string;
  onToggle?: () => void;
  columnName?: string;
  className?: string;
}) {
  const label = direction === "asc" ? ascLabel : direction === "desc" ? descLabel : "Not sorted";
  const Icon = direction === "desc" ? ArrowDown : ArrowUp;
  const body = (
    <>
      {direction && <Icon aria-hidden className="size-3.5" />}
      <span>{label}</span>
      {columnName && <span className="sr-only"> by {columnName}</span>}
    </>
  );
  if (!onToggle) {
    return <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>{body}</span>;
  }
  return (
    <button type="button" onClick={onToggle}
      className={cn("inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground", className)}>
      {body}
    </button>
  );
}
