import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
/**
 * Placeholder rows while a table loads.
 *
 * Bar widths vary per cell from a fixed pattern rather than at random: a
 * skeleton that reshuffles on every render reads as content arriving and
 * leaving again.
 */
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3", "w-4/5"];
export function TableSkeleton({ rows = 5, columns = 4, className }: {
  rows?: number; columns?: number; className?: string;
}) {
  return (
    <div data-slot="table-skeleton" className={cn("divide-y divide-border", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className="flex-1">
              <Skeleton className={cn("h-4", WIDTHS[(r * columns + c) % WIDTHS.length])} />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
