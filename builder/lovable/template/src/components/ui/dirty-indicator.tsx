import { cn } from "@/lib/utils";
/**
 * "Unsaved changes."
 *
 * A dot AND the word, because a lone dot beside a filename is a convention
 * people learn from one app and read wrongly in the next. Renders nothing
 * when clean rather than an "All saved" that is on screen permanently and
 * therefore invisible.
 */
export function DirtyIndicator({ dirty, label = "Unsaved changes", className }: {
  dirty?: boolean; label?: string; className?: string;
}) {
  if (!dirty) return null;
  return (
    <span data-slot="dirty-indicator" className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      aria-live="polite">
      <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
      {label}
    </span>
  );
}
