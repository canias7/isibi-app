import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "142 results for barber" plus whatever controls belong beside it.
 *
 * The query is echoed back because a search box that clears itself on submit —
 * or a result page reached from a link — otherwise leaves somebody looking at
 * results for a term they can no longer see.
 */
export function SearchHeader({ query, count, loading, children, className }: {
  query?: string; count?: number; loading?: boolean;
  children?: React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="search-header" className={cn("flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3", className)}>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {loading ? "Searching…"
          : count == null ? null
          : <>
              <strong className="font-medium tabular-nums text-foreground">{count.toLocaleString()}</strong>
              {count === 1 ? " result" : " results"}
              {query && <> for <strong className="font-medium text-foreground">{query}</strong></>}
            </>}
      </p>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
