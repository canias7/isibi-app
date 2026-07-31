/**
 * Text for screen readers only.
 *
 * Not `display:none` and not `hidden` — both remove it from the accessibility
 * tree as well as from the screen, which is the opposite of the point.
 */
export function VisuallyHidden({ children }: { children?: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
