import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
export type Activity = { who: string; what: string; at: string | number | Date; avatar?: string | null };
/** What happened recently, newest first. */
export function ActivityFeed({ items, empty = "Nothing yet", className }: {
  items: Activity[]; empty?: string; className?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((a, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
          <div className="min-w-0 flex-1">
            <AvatarName name={a.who} subtitle={a.what} src={a.avatar} size="sm" />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground"><TimeAgo date={a.at} /></span>
        </li>
      ))}
    </ol>
  );
}
