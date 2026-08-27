import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Confirmation that a reminder exists, and when it will arrive.
 *
 * THE TIME AND THE CHANNEL TOGETHER. "Reminder set" is not a confirmation of
 * anything — a reminder by email at 08:00 and a push notification an hour before
 * are different promises, and the reader chose one of them.
 *
 * IT OFFERS TO CANCEL. A reminder that cannot be removed from where it is shown
 * sends people hunting through settings, and the usual outcome is that they
 * ignore the reminder instead.
 *
 * Renders nothing when there is no reminder, so it can sit in a layout without
 * printing "no reminder set" on every item.
 */
export function ReminderSet({ at, channel, onCancel, className }: {
  at?: string | number | Date | null;
  /** "by email" · "as a push notification" */
  channel?: string;
  onCancel?: () => void;
  className?: string;
}) {
  if (!at) return null;
  return (
    <p data-slot="reminder-set" role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground", className)}>
      <span>
        Reminder <DateFormat date={at} withTime />
        {channel ? ` ${channel}` : ""}
      </span>
      {onCancel && (
        <button type="button" onClick={onCancel} className="cursor-pointer underline underline-offset-2">Cancel it</button>
      )}
    </p>
  );
}
