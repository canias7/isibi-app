import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/components/ui/notification-item";
import { cn } from "@/lib/utils";
export type Notification = { id: string; title: string; body?: string;
  at?: string | number | Date; unread?: boolean; who?: string };
/** The panel behind the bell, with a mark-all that only shows when it can do something. */
export function NotificationList({ items, onOpen, onMarkAll, empty = "Nothing new", className }: {
  items: Notification[]; onOpen?: (id: string) => void; onMarkAll?: () => void;
  empty?: string; className?: string;
}) {
  const unread = items.filter((n) => n.unread).length;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-1 pb-2">
        <span className="text-sm font-medium">Notifications</span>
        {unread > 0 && onMarkAll && <Button size="sm" variant="ghost" onClick={onMarkAll}>Mark all read</Button>}
      </div>
      {items.length === 0
        ? <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
        : items.map((n) => <NotificationItem key={n.id} {...n} onClick={onOpen ? () => onOpen(n.id) : undefined} />)}
    </div>
  );
}
