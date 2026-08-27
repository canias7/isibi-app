import { cn } from "@/lib/utils";
/** A small number on a thing. Caps rather than growing the pill out of shape. */
export function CountBadge({ count, max = 99, label, className }: {
  count: number; max?: number; label?: string; className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span data-slot="count-badge" className={cn("inline-grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-medium tabular-nums text-background", className)}
      aria-label={label ? `${count} ${label}` : String(count)}>
      {count > max ? `${max}+` : count}
    </span>
  );
}
