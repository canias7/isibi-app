import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/** A page-level message. Dismissible ones remember nothing — that is the caller's job. */
export function Banner({ title, children, icon, action, onDismiss, className }: {
  title?: string; children?: React.ReactNode; icon?: React.ReactNode;
  action?: React.ReactNode; onDismiss?: () => void; className?: string;
}) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-lg border bg-muted/50 px-4 py-3", className)}>
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1 text-sm">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && "mt-0.5", "text-muted-foreground")}>{children}</div>}
      </div>
      {action}
      {onDismiss !== undefined && (
        <button type="button" aria-label="Dismiss" className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => { setGone(true); onDismiss?.(); }}><X className="size-4" /></button>
      )}
    </div>
  );
}
