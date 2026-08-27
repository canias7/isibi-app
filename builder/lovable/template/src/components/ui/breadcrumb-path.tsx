import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Where a file sits, with the middle collapsed when it is long.
 *
 * THE FIRST AND LAST SEGMENTS ARE ALWAYS KEPT. A path truncated from the left
 * loses the root, which is what tells you which drive or workspace you are in;
 * truncated from the right it loses the folder you are actually in. Collapsing
 * the middle keeps both ends, which are the two that matter.
 *
 * A real `<nav aria-label>` containing an ordered list, which is what makes a
 * screen reader announce it as navigation rather than as a row of links.
 *
 * `aria-current="page"` on the last segment, and it is NOT a link — a breadcrumb
 * whose final item navigates to where you already are is a control that does
 * nothing.
 */
export function BreadcrumbPath({ segments, max = 4, className }: {
  segments: { label: string; href?: string }[];
  /** Segments shown before the middle collapses. */
  max?: number;
  className?: string;
}) {
  if (!segments.length) return null;
  const collapse = segments.length > max;
  const shown = collapse
    ? [segments[0], { label: "…" }, ...segments.slice(-(max - 2))]
    : segments;
  return (
    <nav data-slot="breadcrumb-path" aria-label="Path" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {shown.map((s, i) => {
          const last = i === shown.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
              {last ? (
                <span aria-current="page" className="truncate font-medium">{s.label}</span>
              ) : s.href ? (
                <a href={s.href} className="truncate text-muted-foreground underline-offset-4 hover:underline">{s.label}</a>
              ) : (
                <span className="text-muted-foreground">{s.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
