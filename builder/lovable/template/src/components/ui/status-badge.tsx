import { cn } from "@/lib/utils";
/**
 * A state as a chip.
 *
 * The WORD carries the meaning and the colour reinforces it — a badge reading
 * "Cancelled" is unambiguous in black and white, which is why the text is never
 * optional here.
 */
export function StatusBadge({ state = "neutral", className, children }: {
  state?: "success" | "warning" | "danger" | "neutral" | "quiet";
  className?: string; children: React.ReactNode;
}) {
  const v = {
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/35 bg-warning/15 text-warning",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
    neutral: "border-transparent bg-secondary text-secondary-foreground",
    quiet: "border-border text-muted-foreground",
  }[state];
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", v, className)}>
      {children}
    </span>
  );
}
