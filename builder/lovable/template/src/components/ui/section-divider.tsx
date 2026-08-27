import { cn } from "@/lib/utils";
/** A break between sections, optionally labelled. */
export function SectionDivider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr data-slot="section-divider" className={cn("border-border", className)} />;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
