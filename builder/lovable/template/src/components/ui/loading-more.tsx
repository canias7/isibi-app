import { cn } from "@/lib/utils";
/**
 * Skeleton rows appended while the next page arrives.
 *
 * SKELETONS AT THE BOTTOM, NOT A SPINNER. A spinner replaces the list's height
 * with a dot and gives no sense of how much is coming; ghost rows keep the
 * scroll position stable and show the shape of what is landing. This is the
 * only place in a list where a skeleton is right — the FIRST load belongs to
 * `data-list`, which has an empty state and an error sentence this deliberately
 * does not duplicate.
 *
 * IT NEVER RENDERS MORE GHOSTS THAN ARE ACTUALLY COMING. Showing twenty
 * placeholders for the four rows left makes the list visibly shrink when they
 * arrive, which reads as content being removed.
 *
 * `aria-hidden` ON THE GHOSTS with one `role="status"` sentence for the whole
 * block. Announcing eight empty rows individually is noise; "loading more" said
 * once is the fact.
 *
 * The pulse is dropped under `prefers-reduced-motion` — a persistent pulsing
 * block is a genuine problem for some readers, and a static grey row conveys
 * the same thing.
 */
export function LoadingMore({ rows = 3, remaining, height = 44, className }: {
  rows?: number;
  /** Items actually left, so the ghost count cannot exceed them. */
  remaining?: number;
  /** Ghost row height in pixels. */
  height?: number;
  className?: string;
}) {
  const n = Math.max(0, Math.min(rows, remaining ?? rows));
  if (n === 0) return null;
  return (
    <div className={cn("space-y-2 py-2", className)}>
      <span role="status" className="sr-only">Loading more</span>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden="true" style={{ height }}
          className="w-full rounded-md bg-muted motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
