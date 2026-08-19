import { Button } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/count-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
/** The bell with its count, opening a panel. The count is in the label too. */
export function NotificationBell({ count = 0, children, className }: {
  count?: number; children?: React.ReactNode; className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className={className}
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}>
          {/* The badge is shrunk here rather than at its default size: CountBadge
              is 20px and so is the bell, so a full-size one sat ON the icon
              instead of on its corner and the bell was unrecognisable. */}
          <span className="relative inline-flex">
            <Bell className="size-5" />
            {count > 0 && (
              <span className="absolute -end-1.5 -top-1.5">
                <CountBadge count={count} className="h-4 min-w-4 px-1 text-[10px] ring-2 ring-background" />
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">{children}</PopoverContent>
    </Popover>
  );
}
