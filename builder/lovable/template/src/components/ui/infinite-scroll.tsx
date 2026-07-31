import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Load the next page when the reader nears the bottom.
 *
 * THERE IS ALWAYS A "LOAD MORE" BUTTON as well, and it is not a fallback — it
 * is the accessible path. An `IntersectionObserver` sentinel fires on scroll
 * position, which somebody navigating by keyboard or screen reader may never
 * produce; without the button the list simply ends for them.
 *
 * It guards against RE-FIRING. The sentinel stays intersecting while the new
 * page renders, so a naive handler calls `onLoadMore` several times and
 * requests page 2 three times. The guard is `loading`, checked inside the
 * observer rather than only outside it.
 *
 * IT STOPS AT THE END and says so. An infinite list with no terminal state
 * leaves people scrolling to see whether there is more — and a footer becomes
 * unreachable, which is the well-known reason not to use this pattern for
 * anything with a footer worth reaching.
 *
 * An ERROR is shown with a retry rather than silently stopping. A list that
 * quietly stops loading looks identical to one that has ended.
 */
export function InfiniteScroll({
  onLoadMore, hasMore, loading, error, onRetry, rootMargin = "300px", children, className,
}: {
  onLoadMore: () => void;
  hasMore: boolean;
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  rootMargin?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const sentinel = React.useRef<HTMLDivElement>(null);
  const busy = React.useRef(false);
  busy.current = !!loading;

  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || error) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      // The sentinel stays intersecting while the new page renders; without
      // this guard that is three requests for page 2.
      if (entry.isIntersecting && !busy.current) onLoadMore();
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [onLoadMore, hasMore, error, rootMargin]);

  return (
    <div className={className}>
      {children}
      <div ref={sentinel} aria-hidden className="h-px" />
      <div className="flex flex-col items-center gap-2 py-4">
        {error ? (
          <>
            <p role="alert" className="text-xs font-medium">{error}</p>
            {onRetry ? (
              <button type="button" onClick={onRetry}
                className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Try again
              </button>
            ) : null}
          </>
        ) : hasMore ? (
          <button type="button" onClick={onLoadMore} disabled={loading}
            className={cn("cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-60")}>
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">That&rsquo;s everything.</p>
        )}
      </div>
    </div>
  );
}
