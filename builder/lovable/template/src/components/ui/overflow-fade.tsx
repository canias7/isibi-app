import { cn } from "@/lib/utils";
/**
 * A fixed-height block whose text trails off at the bottom.
 *
 * DIFFERENT FROM `read-more`, which folds by LINES and can be opened. This is
 * the decorative half — a fade over content clipped to a height, for cases where
 * the full text lives elsewhere and there is nothing to expand.
 *
 * THE FADE IS `pointer-events-none`. A gradient overlay across the bottom of a
 * scrollable region otherwise swallows clicks on whatever is underneath it,
 * which is invisible in testing and infuriating in use.
 *
 * It fades to `--background` rather than white, so it works in dark mode — a
 * hard-coded white gradient over a dark surface is the single commonest bug in
 * this pattern.
 */
export function OverflowFade({ children, height = 120, fade = 40, className }: {
  children: React.ReactNode;
  /** Visible height in pixels. */
  height?: number;
  /** Height of the fade. */
  fade?: number;
  className?: string;
}) {
  return (
    <div data-slot="overflow-fade" className={cn("relative overflow-hidden", className)} style={{ maxHeight: height }}>
      {children}
      <div aria-hidden style={{ height: fade }}
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
