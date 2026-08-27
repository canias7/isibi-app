import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
/**
 * The element at the bottom of a list that asks for the next page.
 *
 * IT KEEPS A REAL BUTTON, always. Infinite scroll on an IntersectionObserver
 * alone is unreachable by keyboard, defeated by any browser that does not fire
 * the observer, and silently dead when the sentinel never enters the viewport
 * because the list is shorter than the screen. The button IS the feature; the
 * observer is an enhancement that presses it early.
 *
 * `rootMargin` LOADS BEFORE THE SENTINEL IS SEEN — 200px by default — so the
 * next page is already arriving by the time somebody reaches the bottom. A
 * sentinel that fires exactly on contact produces a visible stall on every
 * page.
 *
 * IT REFUSES TO FIRE WHILE `loading`, which is what stops the standard bug:
 * two observers firing on one scroll gesture and requesting page 3 twice, so a
 * page is skipped or duplicated.
 *
 * `role="status"` on the loading text, so a screen reader hears that more is
 * coming rather than finding the list has silently grown.
 */
export function InfiniteSentinel({ onLoadMore, hasMore, loading, rootMargin = "200px", label = "Show more", loadingLabel = "Loading more…", className }: {
  onLoadMore: () => void;
  hasMore: boolean;
  loading?: boolean;
  rootMargin?: string;
  label?: string;
  loadingLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cb.current();
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, rootMargin]);
  if (!hasMore) return null;
  return (
    <div data-slot="infinite-sentinel" ref={ref} className={cn("flex justify-center py-4", className)}>
      {loading ? (
        <span role="status" className="text-sm text-muted-foreground">{loadingLabel}</span>
      ) : (
        <button type="button" onClick={onLoadMore}
          className="rounded-md border border-border px-3 py-1.5 text-sm">
          {label}
        </button>
      )}
    </div>
  );
}
