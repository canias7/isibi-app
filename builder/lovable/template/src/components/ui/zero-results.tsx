import { cn } from "@/lib/utils";
/**
 * Nothing matched — and here is what to change.
 *
 * IT ECHOES THE QUERY BACK. Half of all empty results are a typo, and seeing the
 * term in quotes is what reveals it — far more effective than any suggestion
 * engine.
 *
 * IT DISTINGUISHES "NOTHING MATCHES" FROM "NOTHING HERE YET". An empty search on
 * an empty database is not a search problem, and telling somebody to try
 * different words when there is nothing to find is actively misleading.
 *
 * FILTERS ARE NAMED AS THE LIKELY CAUSE when any are applied, with a way to
 * clear them. Somebody who filtered three screens ago has forgotten, and "no
 * results" while a filter is silently active is the commonest false dead end in
 * any list.
 */
export function ZeroResults({ query, activeFilters, onClearFilters, suggestions, emptyIndex, className }: {
  query?: string;
  /** Filters currently narrowing the search. */
  activeFilters?: string[];
  onClearFilters?: () => void;
  suggestions?: string[];
  /** True when there is nothing to search at all. */
  emptyIndex?: boolean;
  className?: string;
}) {
  if (emptyIndex) {
    return (
      <p data-slot="zero-results" className={cn("text-sm text-muted-foreground", className)}>
        There&apos;s nothing here yet — once you add something, it&apos;ll be searchable.
      </p>
    );
  }
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p className="text-sm font-medium">
        {query ? <>Nothing matches “{query}”</> : "Nothing matches"}
      </p>
      {activeFilters?.length ? (
        <p className="text-sm text-muted-foreground">
          {activeFilters.length} {activeFilters.length === 1 ? "filter is" : "filters are"} narrowing this: {activeFilters.join(", ")}.
          {onClearFilters && (
            <> <button type="button" onClick={onClearFilters} className="cursor-pointer underline underline-offset-4">Clear them</button></>
          )}
        </p>
      ) : null}
      {suggestions?.length ? (
        <p className="text-sm text-muted-foreground">Try: {suggestions.join(", ")}</p>
      ) : null}
    </div>
  );
}
