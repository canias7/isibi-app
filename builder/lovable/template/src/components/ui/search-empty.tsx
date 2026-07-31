import * as React from "react";
import { SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Nothing matches" — and what to do about it.
 *
 * IT SAYS WHICH FILTERS ARE ON and offers to remove them. Most empty results
 * are not an absent record, they are a filter somebody set earlier and forgot —
 * and a bare "no results" leaves them concluding the data is gone. This is the
 * same failure `filter-bar` prevents one step earlier.
 *
 * It DISTINGUISHES an empty search from an empty collection. "No bookings match
 * 'ada'" and "You have no bookings yet" are different situations with different
 * next steps, and showing the first when the second is true makes a new account
 * look broken.
 *
 * It offers CONCRETE next actions — clear the filters, search everything,
 * create one — rather than advice to try different keywords, which is what
 * everybody is already doing.
 *
 * `role="status"`, so the change from results to none is announced.
 */
export function SearchEmpty({
  query, filters, onClearFilters, onClearSearch, onWidenScope, scopeLabel, actions, collectionEmpty, className,
}: {
  query?: string;
  filters?: { key: string; label: React.ReactNode; onRemove?: () => void }[];
  onClearFilters?: () => void;
  onClearSearch?: () => void;
  onWidenScope?: () => void;
  scopeLabel?: React.ReactNode;
  actions?: React.ReactNode;
  collectionEmpty?: boolean;
  className?: string;
}) {
  if (collectionEmpty) {
    return (
      <div role="status" className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
        <p className="text-sm font-medium">Nothing here yet</p>
        {actions}
      </div>
    );
  }
  return (
    <div role="status" className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <SearchX aria-hidden className="size-5 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">
          {query ? <>Nothing matches &ldquo;{query}&rdquo;</> : "Nothing matches these filters"}
          {scopeLabel ? <span className="font-normal text-muted-foreground"> in {scopeLabel}</span> : null}
        </p>
        {filters?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {filters.length} {filters.length === 1 ? "filter is" : "filters are"} still on:{" "}
            {filters.map((f, i) => (
              <React.Fragment key={f.key}>
                {i > 0 ? ", " : ""}
                <span className="text-foreground">{f.label}</span>
              </React.Fragment>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
        {filters?.length && onClearFilters ? (
          <button type="button" onClick={onClearFilters}
            className="cursor-pointer rounded-md border border-border px-2.5 py-1.5 font-medium hover:bg-muted">
            Clear the filters
          </button>
        ) : null}
        {onWidenScope ? (
          <button type="button" onClick={onWidenScope}
            className="cursor-pointer underline underline-offset-2">Search everything</button>
        ) : null}
        {query && onClearSearch ? (
          <button type="button" onClick={onClearSearch}
            className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Clear the search
          </button>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
