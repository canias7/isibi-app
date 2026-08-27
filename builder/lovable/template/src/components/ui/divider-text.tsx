import { cn } from "@/lib/utils";
/** A rule with a word in it — the "or" between a form and a provider button. */
export function DividerText({ children = "or", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div data-slot="divider-text" className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
