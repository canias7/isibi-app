import { cn } from "@/lib/utils";
/**
 * A state, in one glyph.
 *
 * Colour AND shape, never colour alone. The fill differs per state — solid, ring,
 * hollow — so the meaning survives greyscale, print, and anyone who cannot
 * distinguish the hues; the label is always in the accessibility tree even when
 * it is hidden on screen.
 */
export function StatusDot({ state = "on", label, showLabel = true, className }: {
  state?: "on" | "pending" | "off" | "error"; label?: string; showLabel?: boolean; className?: string;
}) {
  const text = label ?? { on: "Active", pending: "Pending", off: "Inactive", error: "Failed" }[state];
  const dot = {
    on: "bg-success",
    pending: "bg-warning ring-2 ring-warning/25",
    off: "border border-muted-foreground/50",
    error: "bg-destructive",
  }[state];
  return (
    <span data-slot="status-dot" className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <span className={showLabel ? "text-sm" : "sr-only"}>{text}</span>
    </span>
  );
}
