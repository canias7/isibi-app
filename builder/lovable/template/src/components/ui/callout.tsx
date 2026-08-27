import { cn } from "@/lib/utils";
/** An aside inside prose. A coloured rule down the left, not a filled box. */
export function Callout({ tone = "neutral", title, icon, className, children }: {
  tone?: "neutral" | "success" | "warning" | "error";
  title?: string; icon?: React.ReactNode; className?: string; children?: React.ReactNode;
}) {
  const rule = { neutral: "border-border", success: "border-success",
                 warning: "border-warning", error: "border-destructive" }[tone];
  return (
    <aside data-slot="callout" className={cn("border-s-2 py-1 ps-4", rule, className)}>
      {(title || icon) && (
        <div className="flex items-center gap-2 font-medium">
          {icon && <span className="[&_svg]:size-4">{icon}</span>}{title}
        </div>
      )}
      <div className={cn("text-sm text-muted-foreground", (title || icon) && "mt-1")}>{children}</div>
    </aside>
  );
}
