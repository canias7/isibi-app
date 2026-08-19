import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/** One comment: who, when, what, and what you can do about it. */
export function Comment({ author, at, body, avatar, actions, edited, className }: {
  author: string; at?: string | number | Date; body: React.ReactNode;
  avatar?: string | null; actions?: React.ReactNode; edited?: boolean; className?: string;
}) {
  return (
    <article className={cn("flex flex-col gap-2 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AvatarName name={author} src={avatar} size="sm" />
        <span className="text-xs text-muted-foreground">
          {at && <TimeAgo date={at} />}{edited && <span className="ms-1">(edited)</span>}
        </span>
      </div>
      <div className="text-sm">{body}</div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </article>
  );
}
