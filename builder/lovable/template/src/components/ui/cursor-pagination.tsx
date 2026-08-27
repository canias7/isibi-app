import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Next and previous for a cursor-paged API.
 *
 * NO PAGE NUMBERS, and that is the point rather than a limitation. A cursor API
 * cannot jump to page 7 — there is no offset — and a control offering numbered
 * pages over one either lies or quietly fetches every page in between. If page
 * numbers are wanted, the API has to be offset-paged and this is the wrong
 * component.
 *
 * It shows the RANGE it is on ("21–40"), which is the honest version of "page
 * 2" and the only positional information a cursor gives. A total appears only
 * when the caller supplies one, because a cursor API frequently cannot count
 * without a second expensive query.
 *
 * "Next" is disabled by the ABSENCE OF A CURSOR, never by comparing a count. A
 * page that comes back short is not the last page — some APIs filter after
 * paging — and only the missing next cursor says the end has been reached.
 *
 * Both buttons keep their labels next to the arrows, because two bare chevrons
 * side by side are guessed wrong often enough to matter.
 */
export function CursorPagination({
  onPrev, onNext, hasPrev, hasNext, from, to, total, loading, className,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  from?: number;
  to?: number;
  total?: number;
  loading?: boolean;
  className?: string;
}) {
  return (
    <nav data-slot="cursor-pagination" aria-label="Pagination" className={cn("flex items-center gap-3", className)}>
      <button type="button" onClick={onPrev} disabled={!hasPrev || loading}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
        <ChevronLeft aria-hidden className="size-3.5" />
        Previous
      </button>
      <p aria-live="polite" className="min-w-0 flex-1 text-center text-xs text-muted-foreground tabular-nums">
        {loading ? "Loading…"
          : from != null && to != null
            ? <>{from.toLocaleString()}&ndash;{to.toLocaleString()}{total != null ? ` of ${total.toLocaleString()}` : null}</>
            : null}
      </p>
      <button type="button" onClick={onNext} disabled={!hasNext || loading}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
        Next
        <ChevronRight aria-hidden className="size-3.5" />
      </button>
    </nav>
  );
}
