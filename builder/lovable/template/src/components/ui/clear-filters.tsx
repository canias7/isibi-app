import { cn } from "@/lib/utils";
/**
 * The way out of a filter set that has gone wrong.
 *
 * IT SAYS HOW MANY IT WILL CLEAR. "Clear all" gives no sense of scale, and
 * somebody who has spent a minute building a view wants to know whether the
 * button costs them one setting or nine before they press it.
 *
 * IT DISAPPEARS WHEN THERE IS NOTHING TO CLEAR rather than sitting disabled. A
 * permanently visible greyed-out button is a control people learn to ignore,
 * and this one has to be noticed at the moment a list looks empty.
 *
 * IT CAN KEEP THE SEARCH TEXT. Clearing filters and wiping what somebody typed
 * are different intentions — most people mean "same search, no filters" — so
 * when a query is present it is called out and left alone unless the caller
 * says otherwise.
 *
 * NO CONFIRMATION. Clearing filters destroys nothing and is a second's work to
 * redo; a dialog here is the kind that teaches people to dismiss dialogs.
 */
export function ClearFilters({ activeCount, onClear, query, onClearQuery, label = "Clear filters", className }: {
  activeCount: number;
  onClear: () => void;
  /** Current search text, if any — reported so it is clear it survives. */
  query?: string;
  /** Offered separately when a query is present. */
  onClearQuery?: () => void;
  label?: string;
  className?: string;
}) {
  if (activeCount <= 0 && !query) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}>
      {activeCount > 0 && (
        <button type="button" onClick={onClear} className="underline underline-offset-2">
          {label}
          <span className="ms-1 tabular-nums text-muted-foreground">{activeCount}</span>
        </button>
      )}
      {query && (
        <span className="text-xs text-muted-foreground">
          Your search for “{query}” stays
          {onClearQuery && (
            <>
              {" · "}
              <button type="button" onClick={onClearQuery} className="underline underline-offset-2">clear that too</button>
            </>
          )}
        </span>
      )}
    </span>
  );
}
