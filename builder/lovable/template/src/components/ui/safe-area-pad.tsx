import { cn } from "@/lib/utils";
/**
 * Padding that clears the notch, the home indicator and the rounded corners.
 *
 * WITHOUT IT, A FIXED BOTTOM BAR SITS UNDER THE HOME INDICATOR on every recent
 * iPhone — the buttons are visible, tappable in principle, and swallowed by the
 * system gesture in practice. It is the commonest reason a mobile action bar
 * "does not work" while looking perfectly fine in a simulator screenshot.
 *
 * `env(safe-area-inset-*)` with a `max()` fallback, so it never produces LESS
 * padding than asked for on a device with no insets at all — writing the env
 * value alone collapses to zero on desktop.
 *
 * Per-side flags, because a bottom bar needs the bottom and a full-bleed header
 * needs the top, and applying all four wastes space on the sides for nothing.
 */
export function SafeAreaPad({ top, bottom, sides, min = 0, children, className }: {
  top?: boolean; bottom?: boolean; sides?: boolean;
  /** Minimum padding in pixels, kept when there are no insets. */
  min?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const px = `${min}px`;
  return (
    <div data-slot="safe-area-pad"
      style={{
        paddingTop: top ? `max(${px}, env(safe-area-inset-top))` : undefined,
        paddingBottom: bottom ? `max(${px}, env(safe-area-inset-bottom))` : undefined,
        paddingLeft: sides ? `max(${px}, env(safe-area-inset-left))` : undefined,
        paddingRight: sides ? `max(${px}, env(safe-area-inset-right))` : undefined,
      }}
      className={cn(className)}>
      {children}
    </div>
  );
}
