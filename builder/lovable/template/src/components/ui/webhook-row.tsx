import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * One endpoint, its events, and whether it is actually working.
 *
 * The last delivery is the field that matters — a webhook row without one
 * looks identical whether it is fine or has been failing for a fortnight.
 */
export function WebhookRow({ url, events, state = "on", lastDeliveryAt, lastError, onEdit, onDelete, className }: {
  url: string; events?: string[]; state?: "on" | "pending" | "off" | "error";
  lastDeliveryAt?: string | number | Date | null; lastError?: string | null;
  onEdit?: () => void; onDelete?: () => void; className?: string;
}) {
  return (
    <div data-slot="webhook-row" className={cn("flex flex-wrap items-start gap-3 border-b border-border py-3 last:border-0", className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm">{url}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <StatusDot state={state} />
          {events?.length ? <span>{events.join(", ")}</span> : null}
          {lastDeliveryAt && <span>Last delivery <TimeAgo date={lastDeliveryAt} /></span>}
        </div>
        {state === "error" && lastError && (
          <p className="mt-1 text-xs text-destructive">{lastError}</p>
        )}
      </div>
      <div className="flex gap-2">
        {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>}
        {onDelete && <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>}
      </div>
    </div>
  );
}
