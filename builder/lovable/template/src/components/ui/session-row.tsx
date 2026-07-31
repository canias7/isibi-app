import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * One signed-in device.
 *
 * The current session cannot be revoked from here — signing yourself out from a
 * device list is confusing, and there is a Sign out for that.
 */
export function SessionRow({ device, where, lastSeen, current, onRevoke, className }: {
  device: string; where?: string | null; lastSeen?: string | number | Date;
  current?: boolean; onRevoke?: () => void; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border py-3 last:border-0", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {device}
          {current && <StatusDot state="on" label="This device" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {where}{where && lastSeen ? " · " : ""}{lastSeen && <TimeAgo date={lastSeen} />}
        </div>
      </div>
      {!current && onRevoke && <Button size="sm" variant="ghost" onClick={onRevoke}>Sign out</Button>}
    </div>
  );
}
