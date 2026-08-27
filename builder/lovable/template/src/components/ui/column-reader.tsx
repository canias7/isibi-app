import { cn } from "@/lib/utils";
/**
 * Long prose set to a readable measure.
 *
 * THE MEASURE IS THE WHOLE COMPONENT. Text running the full width of a desktop
 * screen is the commonest readability failure on the web: past about 75
 * characters the eye loses the start of the next line on the return sweep. The
 * default here is 65ch, which is the middle of the range typography has agreed
 * on for a century.
 *
 * `ch` UNITS, NOT PIXELS, so the measure holds when the reader changes the font
 * size — a 640px column is 65 characters at one size and 40 at another, which
 * defeats the point at exactly the moment it matters most.
 *
 * Multi-column is offered but capped at two and disabled below `md`: columns on
 * a phone mean scrolling down to the bottom and back to the top for every one,
 * which is worse than no columns at all.
 */
export function ColumnReader({ children, measure = 65, columns = 1, className }: {
  children: React.ReactNode;
  /** Characters per line. 45-75 is the readable range. */
  measure?: number;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div data-slot="column-reader"
      style={{ maxWidth: columns === 2 ? undefined : `${measure}ch`, columnWidth: columns === 2 ? `${measure / 2}ch` : undefined }}
      className={cn("text-sm leading-relaxed", columns === 2 && "md:columns-2 md:gap-8", className)}>
      {children}
    </div>
  );
}
