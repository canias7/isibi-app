import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A page-level message.
 *
 * Each tone brings its own ICON as well as its own colour, so the four are
 * distinguishable without seeing the hues at all — the tinted background alone
 * would leave a colour-blind reader guessing which of the four this is.
 */
export function Banner({ tone = "info", title, children, icon, action, onDismiss, className }: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string; children?: React.ReactNode; icon?: React.ReactNode;
  action?: React.ReactNode; onDismiss?: () => void; className?: string;
}) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  const skin = {
    info: "border-border bg-muted/50 text-muted-foreground",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/35 bg-warning/10 text-warning",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  }[tone];
  const Fallback = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"}
      className={cn("motion-enter flex items-start gap-3 rounded-lg border px-4 py-3", skin, className)}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Fallback />}</span>
      <div className="min-w-0 flex-1 text-sm text-foreground">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && "mt-0.5", "text-muted-foreground")}>{children}</div>}
      </div>
      {action}
      {onDismiss !== undefined && (
        <button type="button" aria-label="Dismiss" className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => { setGone(true); onDismiss?.(); }}>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
