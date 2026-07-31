import { cn } from "@/lib/utils";
/** The "new" line in a list. Announced, not just drawn. */
export function UnreadDivider({ label = "New", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-1", className)} role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-foreground/30" />
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
      <span className="h-px flex-1 bg-foreground/30" />
    </div>
  );
}
