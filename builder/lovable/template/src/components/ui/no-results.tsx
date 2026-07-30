import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Nothing matched — and what to try instead.
 *
 * The suggestions are the point. "No results" on its own is a dead end; a
 * spelling to try or a filter to drop is a way out of one.
 */
export function NoResults({ query, suggestions, onSuggestion, onClearFilters, className }: {
  query?: string; suggestions?: string[]; onSuggestion?: (q: string) => void;
  onClearFilters?: () => void; className?: string;
}) {
  return (
    <div className={cn("px-6 py-12 text-center", className)}>
      <p className="text-sm font-medium">
        {query ? <>Nothing matched “{query}”.</> : "Nothing matched."}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Check the spelling, or try a shorter search.</p>
      {suggestions?.length && onSuggestion ? (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Try:</span>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => onSuggestion(s)}
              className="cursor-pointer underline underline-offset-2 hover:no-underline">{s}</button>
          ))}
        </p>
      ) : null}
      {onClearFilters && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>Clear filters</Button>
      )}
    </div>
  );
}
