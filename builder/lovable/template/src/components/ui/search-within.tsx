import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Search inside what is already on screen.
 *
 * SCOPED, AND THE SCOPE IS IN THE PLACEHOLDER — "Search in Repairs" rather than
 * "Search". A second search box on a page of results is otherwise
 * indistinguishable from the first, and people type into it expecting to start
 * over.
 *
 * THE CLEAR BUTTON IS A REAL BUTTON with a name, not an X somebody has to guess
 * at. `type="search"` alone gives an inconsistent native clear that is missing
 * in several browsers.
 *
 * IT REPORTS THE NARROWED COUNT in a live region, because the visible effect is
 * a list shrinking somewhere else on the page and a screen reader gets no notice
 * of it at all.
 */
export function SearchWithin({ value, onChange, scope, count, id, className }: {
  value: string;
  onChange: (v: string) => void;
  /** What is being searched inside — "Repairs". */
  scope: string;
  /** Matches after narrowing. */
  count?: number;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const inputId = id ?? auto;
  return (
    <div data-slot="search-within" className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className="sr-only">Search in {scope}</label>
      <div className="relative">
        <Search aria-hidden className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input id={inputId} type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`Search in ${scope}`}
          className="h-9 w-full rounded-md border border-input bg-transparent pe-9 ps-8 text-sm" />
        {value && (
          <button type="button" onClick={() => onChange("")} aria-label={`Clear search in ${scope}`}
            className="absolute top-1/2 end-2 -translate-y-1/2 cursor-pointer rounded p-0.5 hover:bg-muted">
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground tabular-nums">
        {value && typeof count === "number" ? `${count} matching in ${scope}` : ""}
      </p>
    </div>
  );
}
