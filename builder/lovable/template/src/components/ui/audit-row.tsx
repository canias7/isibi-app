import { StatusDot } from "@/components/ui/status-dot";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * One line of a security log.
 *
 * A stranger is shown as a tag rather than an address, which is what a per-site
 * fingerprint is for: the owner needs "the same unknown, forty times", not a
 * contact list of people who never had an account.
 */
export function AuditRow({ action, who, at, ok = true, detail, className }: {
  action: string; who: string; at: string | number | Date;
  ok?: boolean; detail?: string | null; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0", className)}>
      <StatusDot state={ok ? "on" : "error"} showLabel={false} label={ok ? "Succeeded" : "Failed"} />
      <span className="w-40 shrink-0 truncate font-medium">{action}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{who}{detail ? ` · ${detail}` : ""}</span>
      <span className="shrink-0 text-xs text-muted-foreground"><TimeAgo date={at} /></span>
    </div>
  );
}
