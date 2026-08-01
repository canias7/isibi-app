import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The control that opens a row's detail underneath it.
 *
 * THE DETAIL BELONGS IN A ROW WITH `colSpan`, not in a floating panel — that is
 * the only version that keeps the table's structure intact for a screen reader
 * and survives printing.
 *
 * `aria-expanded` and `aria-controls` on the toggle, pointing at the detail
 * row's id. Without them the extra row simply appears in the reading order with
 * nothing explaining where it came from.
 *
 * THE BUTTON NAMES THE ROW. A column of chevrons all called "Expand" is what a
 * screen reader gets otherwise, in the one place where which row you are on is
 * the entire question.
 */
export function RowExpand({ open, onToggle, rowLabel, detailId, className }: {
  open: boolean;
  onToggle: () => void;
  /** What the row is, for the accessible name. */
  rowLabel: string;
  /** id of the detail row this controls. */
  detailId: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={onToggle}
      aria-expanded={open} aria-controls={detailId}
      aria-label={`${open ? "Hide" : "Show"} details for ${rowLabel}`}
      className={cn("cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      <ChevronRight aria-hidden className={cn("size-4 transition-transform", open && "rotate-90")} />
    </button>
  );
}
