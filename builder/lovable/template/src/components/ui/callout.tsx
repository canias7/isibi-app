import { cn } from "@/lib/utils";
/** An aside inside prose. A rule down the left, not a coloured box. */
export function Callout({ title, icon, className, children }: {
  title?: string; icon?: React.ReactNode; className?: string; children?: React.ReactNode;
}) {
  return (
    <aside className={cn("border-l-2 py-1 pl-4", className)}>
      {(title || icon) && (
        <div className="flex items-center gap-2 font-medium">
          {icon && <span className="[&_svg]:size-4">{icon}</span>}{title}
        </div>
      )}
      <div className={cn("text-sm text-muted-foreground", (title || icon) && "mt-1")}>{children}</div>
    </aside>
  );
}
