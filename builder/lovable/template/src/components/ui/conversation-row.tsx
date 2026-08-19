import { AvatarName } from "@/components/ui/avatar-name";
import { CountBadge } from "@/components/ui/count-badge";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * One conversation in an inbox.
 *
 * The preview is a single truncated line, never wrapped: a list whose rows
 * change height with the length of the last message cannot be scanned, and
 * scanning is the only thing this list is for.
 */
export function ConversationRow({ name, preview, at, unread = 0, avatar, active, onClick, className }: {
  name: string; preview?: string; at?: string | number | Date; unread?: number;
  avatar?: string | null; active?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex w-full cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 text-start last:border-0",
        active ? "bg-muted" : "hover:bg-muted/50", className)}>
      <AvatarName name={name} src={avatar} size="md" avatarOnly />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("truncate text-sm", unread > 0 && "font-medium")}>{name}</span>
          {at && <span className="ms-auto shrink-0 text-[10px] text-muted-foreground"><TimeAgo date={at} /></span>}
        </span>
        {preview && <span className={cn("mt-0.5 block truncate text-xs",
          unread > 0 ? "text-foreground" : "text-muted-foreground")}>{preview}</span>}
      </span>
      {unread > 0 && <CountBadge count={unread} label="unread" className="h-5 min-w-5 text-[10px]" />}
    </button>
  );
}
