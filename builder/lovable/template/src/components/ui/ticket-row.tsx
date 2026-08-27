import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { IdBadge } from "@/components/ui/id-badge";
import { cn } from "@/lib/utils";
/**
 * A support ticket in a queue.
 *
 * "Last reply" rather than "created": the useful sort in a support queue is
 * how long somebody has been waiting for an ANSWER, and a ticket opened this
 * morning that was already replied to is not the urgent one.
 */
export function TicketRow({ id, subject, requester, state = "open", lastReplyAt, assignee, onClick, className }: {
  id: string; subject: string; requester?: string;
  state?: "open" | "pending" | "resolved" | "closed";
  lastReplyAt?: string | number | Date; assignee?: string | null;
  onClick?: () => void; className?: string;
}) {
  const tone = { open: "warning", pending: "neutral", resolved: "success", closed: "quiet" } as const;
  return (
    <div data-slot="ticket-row" className={cn("flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0", className)}>
      <IdBadge id={id} head={8} />
      <button type="button" onClick={onClick} disabled={!onClick}
        className={cn("min-w-0 flex-1 text-start", onClick && "cursor-pointer hover:underline")}>
        <span className="block truncate text-sm font-medium">{subject}</span>
        {requester && <span className="block text-xs text-muted-foreground">{requester}</span>}
      </button>
      <StatusBadge state={tone[state]} className="capitalize">{state}</StatusBadge>
      {lastReplyAt && <span className="text-xs text-muted-foreground">Last reply <TimeAgo date={lastReplyAt} /></span>}
      {assignee ? <AvatarName name={assignee} size="sm" avatarOnly />
        : <span className="text-xs text-muted-foreground">Unassigned</span>}
    </div>
  );
}
