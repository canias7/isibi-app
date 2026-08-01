import { cn } from "@/lib/utils";
/**
 * An issue in production — with the deadline that is actually binding.
 *
 * THE PRESS BOOKING IS THE REAL DEADLINE AND IS THE ONE PEOPLE FORGET. Copy
 * dates slip and get absorbed; a press slot is booked, paid for and given away
 * if missed, and everything upstream is negotiable only until then. Showing the
 * publication date alone makes the whole schedule look softer than it is.
 *
 * PAGE COUNT IS FIXED BY THE PRESS, in multiples the binding allows. An issue
 * running four pages over is not a small overrun — it is a different signature
 * and a different price, and it is decided weeks before anybody notices.
 *
 * THE ADVERTISING RATIO IS SHOWN because it determines the editorial pages
 * available, and editors plan against a page count that advertising is still
 * moving.
 *
 * AN ISSUE ALREADY AT THE PRINTER CANNOT BE CHANGED, and saying so stops the
 * conversation that wastes an afternoon.
 */
export function IssueRow({ issue, publishedOn, copyDeadline, pressBooking, atPrinter, pages, pageMultiple = 4, adPages, className }: {
  issue: string;
  /** Free text — "September". */
  publishedOn?: string;
  copyDeadline?: string;
  /** The booked press slot — the binding one. */
  pressBooking?: string;
  /** True once it has gone. */
  atPrinter?: boolean;
  pages?: number;
  /** Pages must come in multiples of this. */
  pageMultiple?: number;
  adPages?: number;
  className?: string;
}) {
  const offMultiple = pages !== undefined && pages % pageMultiple !== 0;
  const editorial = pages !== undefined && adPages !== undefined ? pages - adPages : undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {issue}
          {publishedOn && <span className="text-muted-foreground"> · out {publishedOn}</span>}
        </span>
        {pages !== undefined && (
          <span className="shrink-0 tabular-nums text-muted-foreground">{pages} pages</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {copyDeadline && `Copy by ${copyDeadline}`}
        {copyDeadline && pressBooking ? " · " : ""}
        {pressBooking && `on press ${pressBooking}`}
      </p>
      {pressBooking && !atPrinter && (
        <p className="text-xs font-medium">
          The press slot is the deadline that cannot move — everything before it can.
        </p>
      )}
      {offMultiple && pages !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          {pages} is not a multiple of {pageMultiple} — the binding cannot take it.
        </p>
      )}
      {editorial !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {adPages} advertising, {editorial} editorial.
        </p>
      )}
      {atPrinter && <p className="text-xs font-medium">At the printer. Nothing can be changed.</p>}
    </li>
  );
}
