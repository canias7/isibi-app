import { TimeAgo } from "@/components/ui/time-ago";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "These numbers are from 20 minutes ago."
 *
 * Shown only once the data is actually old — `afterMinutes`, default 5 —
 * because a freshness note on fresh data is noise that trains people to
 * ignore it on the day it matters.
 *
 * Cached figures presented as live is how somebody acts on a booking count
 * that changed half an hour ago.
 */
export function StaleDataNote({ at, afterMinutes = 5, onRefresh, className }: {
  at: string | number | Date; afterMinutes?: number; onRefresh?: () => void; className?: string;
}) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  if (Date.now() - d.getTime() < afterMinutes * 60_000) return null;
  return (
    <p className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
      <RefreshCw className="size-3.5" />
      Last updated <TimeAgo date={d} />
      {onRefresh && <button type="button" onClick={onRefresh}
        className="cursor-pointer underline underline-offset-2 hover:text-foreground">Refresh</button>}
    </p>
  );
}
