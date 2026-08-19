import { cn } from "@/lib/utils";
/**
 * The guide lines that show how deep a row sits in a tree.
 *
 * Indentation alone stops being readable at about three levels — the eye cannot
 * hold which parent a row belongs to across a screen of whitespace. The lines
 * are what make level 5 legible.
 *
 * DEPTH IS ANNOUNCED, not just drawn. The rails are `aria-hidden` and an
 * `sr-only` "Level 3" carries the same fact, because indentation is invisible
 * to a screen reader and `aria-level` only works inside a real `tree` role,
 * which this is not — it is the spacer used inside whatever the caller built.
 *
 * The LAST rail is shorter and forms an elbow into the row, which is what tells
 * the reader this row hangs off that parent rather than merely sitting near it.
 *
 * Depth is clamped, because a corrupt tree with depth 400 should indent oddly
 * rather than push a row 6,000 pixels off the side of the page.
 */
export function NestIndent({ depth, unit = 16, max = 12, className }: {
  /** 0 is top level. */
  depth: number;
  /** Pixels per level. */
  unit?: number;
  max?: number;
  className?: string;
}) {
  const d = Math.min(Math.max(Math.floor(depth), 0), max);
  if (d === 0) return null;
  return (
    <span className={cn("inline-flex shrink-0 self-stretch", className)}>
      <span className="sr-only">Level {d + 1}. </span>
      {Array.from({ length: d }, (_, i) => (
        <span key={i} aria-hidden style={{ width: unit }} className="relative inline-block">
          <span className={cn("absolute top-0 start-1/2 w-px bg-border", i === d - 1 ? "h-1/2" : "h-full")} />
          {i === d - 1 && (
            <span className="absolute top-1/2 start-1/2 h-px w-1/2 bg-border" />
          )}
        </span>
      ))}
    </span>
  );
}
