import { cn } from "@/lib/utils";
/**
 * "All 20 on this page are selected. Select all 1,247?"
 *
 * THE MOST EXPENSIVE MISTAKE IN ANY LIST INTERFACE is a select-all that quietly
 * means more than the reader thinks, followed by a delete. This is the strip
 * that removes the ambiguity: it states the number currently selected, states
 * the number that exist, and makes reaching the larger set a separate,
 * deliberate press.
 *
 * The counts are always WRITTEN OUT, never "all". "All selected" is exactly the
 * phrase that means two different things here, and the whole component exists
 * because of it.
 *
 * Once the wider set is chosen the strip CHANGES rather than disappears —
 * "All 1,247 selected · Select only this page" — because the dangerous state is
 * the one that needs a visible way out, not the safe one.
 *
 * `role="status"` so the change is announced: this strip appears in response to
 * a tick, and a sighted reader sees it arrive where a screen reader would get
 * nothing at all.
 */
export function CrossPageSelection({
  pageSelected, pageTotal, allTotal, allSelected, onSelectAll, onSelectPage, onClear, className,
}: {
  /** Ticked on the page in view. */
  pageSelected: number;
  /** Rows on the page in view. */
  pageTotal: number;
  /** Rows in the whole result set. */
  allTotal: number;
  /** True once the wider set has been chosen. */
  allSelected?: boolean;
  onSelectAll: () => void;
  onSelectPage: () => void;
  onClear?: () => void;
  className?: string;
}) {
  if (!allSelected && pageSelected < pageTotal) return null;
  if (allTotal <= pageTotal && !allSelected) return null;

  return (
    <div data-slot="cross-page-selection" role="status"
      className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm", className)}>
      {allSelected ? (
        <>
          <span className="font-medium tabular-nums">All {allTotal.toLocaleString()} selected</span>
          <button type="button" onClick={onSelectPage}
            className="cursor-pointer underline underline-offset-4">
            Select only this page ({pageTotal.toLocaleString()})
          </button>
        </>
      ) : (
        <>
          <span className="tabular-nums">
            All {pageTotal.toLocaleString()} on this page selected
          </span>
          <button type="button" onClick={onSelectAll}
            className="cursor-pointer font-medium underline underline-offset-4">
            Select all {allTotal.toLocaleString()}
          </button>
        </>
      )}
      {onClear && (
        <button type="button" onClick={onClear}
          className="cursor-pointer text-muted-foreground underline underline-offset-4">Clear</button>
      )}
    </div>
  );
}
