import { cn } from "@/lib/utils";
/**
 * The line under a field that says what to put in it.
 *
 * IT SITS ABOVE THE INPUT, NOT BELOW, when it is guidance rather than an error.
 * Help printed underneath is read after the attempt, which is too late — the
 * format rule people needed is discovered by getting it wrong.
 *
 * IT IS NOT A PLACEHOLDER, and that is the whole point. Placeholder text
 * disappears the moment somebody types, so the format they were following
 * vanishes exactly when they are checking their work — and it is invisible to a
 * screen reader unless separately wired.
 *
 * A stable `id` for the caller's `aria-describedby`. Without that link the hint
 * is decoration.
 */
export function InlineHint({ children, id, className }: {
  children: React.ReactNode;
  /** Point the input's aria-describedby here. */
  id?: string;
  className?: string;
}) {
  return (
    <p data-slot="inline-hint" id={id} className={cn("text-xs text-muted-foreground", className)}>{children}</p>
  );
}
