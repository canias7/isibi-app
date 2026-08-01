import { cn } from "@/lib/utils";
/**
 * Skip straight to a region of the page.
 *
 * MORE THAN ONE SKIP LINK. Almost every site ships "skip to content" and stops,
 * but a page with a filter panel, a results list and a detail pane needs three —
 * and a screen reader user who lands on the wrong one has to walk the whole
 * page.
 *
 * VISIBLE ON FOCUS, HIDDEN OTHERWISE. `sr-only` until focused is the convention
 * because it costs sighted readers nothing and appears the instant somebody
 * Tabs — a permanently visible row of skip links is why most designers remove
 * them entirely.
 *
 * THE TARGETS MUST BE FOCUSABLE, which is the caller's job: a link to a `<main>`
 * with no `tabindex="-1"` moves the viewport and leaves focus behind in several
 * browsers, which is the bug that makes skip links appear not to work.
 */
export function LandmarkNav({ targets, className }: {
  /** Each id must exist and carry tabindex="-1". */
  targets: { id: string; label: string }[];
  className?: string;
}) {
  if (!targets.length) return null;
  return (
    <nav aria-label="Skip to" className={cn(className)}>
      <ul className="flex gap-2">
        {targets.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`}
              className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-1.5 focus:text-sm">
              Skip to {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
