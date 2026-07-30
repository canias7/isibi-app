import { cn } from "@/lib/utils";
/**
 * A state, in one glyph.
 *
 * Monochrome on purpose: fill, outline and hollow rather than green/amber/red.
 * Colour alone is not a signal anyone can rely on, and the label is always
 * rendered for a screen reader even when it is hidden visually.
 */
export function StatusDot({ state = "on", label, showLabel = true, className }: {
  state?: "on" | "pending" | "off"; label?: string; showLabel?: boolean; className?: string;
}) {
  const text = label ?? { on: "Active", pending: "Pending", off: "Inactive" }[state];
  const dot = { on: "bg-foreground", pending: "bg-foreground/40", off: "border border-muted-foreground/50" }[state];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <span className={showLabel ? "text-sm" : "sr-only"}>{text}</span>
    </span>
  );
}
