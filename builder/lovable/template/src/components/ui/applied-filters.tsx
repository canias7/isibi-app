import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The filters currently narrowing a list, each removable.
 *
 * Named as well as valued — "Price: under £50", not "under £50" — because a
 * bare value gives no way to tell which control put it there when two facets
 * share a vocabulary.
 */
export function AppliedFilters({ filters, onRemove, onClearAll, className }: {
  filters: { key: string; label: string; value: string }[];
  onRemove: (key: string) => void; onClearAll?: () => void; className?: string;
}) {
  if (!filters.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((f) => (
        <span key={f.key} className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 ps-2.5 pe-1 text-xs">
          <span className="text-muted-foreground">{f.label}:</span>
          <span>{f.value}</span>
          <button type="button" onClick={() => onRemove(f.key)} aria-label={`Remove ${f.label} filter`}
            className="cursor-pointer rounded-full p-0.5 hover:bg-muted">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {filters.length > 1 && onClearAll && (
        <button type="button" onClick={onClearAll}
          className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Clear all
        </button>
      )}
    </div>
  );
}
