import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "All 25 on this page are selected — select all 1,340?"
 *
 * The distinction is the whole point: without it somebody ticks the header box,
 * presses Delete, and finds out afterwards whether that meant the page or the
 * table. It renders nothing until the page is fully selected.
 */
export function SelectAllBanner({ pageCount, totalCount, allSelected, onSelectAll, onClear, className }: {
  pageCount: number; totalCount: number; allSelected?: boolean;
  onSelectAll: () => void; onClear: () => void; className?: string;
}) {
  if (totalCount <= pageCount) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-sm", className)}>
      {allSelected ? (
        <>
          <span>All <strong className="tabular-nums">{totalCount.toLocaleString()}</strong> selected.</span>
          <Button size="sm" variant="link" className="h-auto p-0" onClick={onClear}>Clear selection</Button>
        </>
      ) : (
        <>
          <span>All <strong className="tabular-nums">{pageCount}</strong> on this page selected.</span>
          <Button size="sm" variant="link" className="h-auto p-0" onClick={onSelectAll}>
            Select all {totalCount.toLocaleString()}
          </Button>
        </>
      )}
    </div>
  );
}
