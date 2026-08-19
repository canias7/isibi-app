import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A table row that opens to show more, in a second row underneath.
 *
 * The expanded panel is its own `<tr>` spanning every column, NOT a cell that
 * grows: a tall cell forces the whole row tall and drags the other columns'
 * content to the top of a half-empty box. It also keeps the table a table, so
 * the columns still line up.
 *
 * The toggle is on a BUTTON inside the first cell rather than on the row: a
 * clickable `<tr>` is unreachable from a keyboard, and rows in real tables
 * usually contain their own links and buttons, which a row-wide handler then
 * swallows.
 *
 * `aria-expanded` and `aria-controls` are what make the second row findable —
 * without them a screen reader hears a button that appears to do nothing.
 */
export function RowDetail({
  id, open, onToggle, columns, children, detail, className,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  columns: number;
  children: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <tr className={cn("border-b border-border", open && "bg-muted/40", className)}>
        <td className="w-8 ps-2 align-middle">
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`detail-${id}`}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight aria-hidden className={cn("size-4 transition-transform", open && "rotate-90")} />
            <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
          </button>
        </td>
        {children}
      </tr>
      {open ? (
        <tr id={`detail-${id}`} className="border-b border-border bg-muted/40">
          <td colSpan={columns + 1} className="px-4 py-3">{detail}</td>
        </tr>
      ) : null}
    </>
  );
}
