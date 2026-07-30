import { cn } from "@/lib/utils";
/** A pill that turns on and off. A real button with `aria-pressed`. */
export function ToggleChip({ pressed, onToggle, className, children }: {
  pressed?: boolean; onToggle: () => void; className?: string; children?: React.ReactNode;
}) {
  return (
    <button type="button" aria-pressed={!!pressed} onClick={onToggle}
      className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm",
        pressed ? "border-foreground bg-foreground text-background" : "hover:bg-muted", className)}>
      {children}
    </button>
  );
}
