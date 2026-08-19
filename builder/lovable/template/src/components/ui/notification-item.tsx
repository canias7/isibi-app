import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/** One notification. Unread carried by weight and a dot, not colour alone. */
export function NotificationItem({ title, body, at, unread, who, onClick, className }: {
  title: string; body?: string; at?: string | number | Date;
  unread?: boolean; who?: string; onClick?: () => void; className?: string;
}) {
  const inner = (
    <>
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", unread ? "bg-foreground" : "bg-transparent")}
        aria-hidden="true" />
      <span className="min-w-0 flex-1 text-start">
        <span className={cn("block text-sm", unread && "font-medium")}>{title}</span>
        {body && <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>}
        <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {who && <AvatarName name={who} size="sm" />}
          {at && <TimeAgo date={at} />}
        </span>
      </span>
      {unread && <span className="sr-only">Unread</span>}
    </>
  );
  const base = "flex w-full items-start gap-2.5 border-b border-border py-3 last:border-0";
  return onClick
    ? <button type="button" onClick={onClick} className={cn(base, "cursor-pointer text-start hover:bg-muted/50", className)}>{inner}</button>
    : <div className={cn(base, className)}>{inner}</div>;
}
