import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Saving is refused right now, and here is why.
 *
 * THE REASON IS REQUIRED, not optional. A form that stops accepting input
 * without saying why is indistinguishable from a broken one, and the support
 * ticket that follows costs more than the sentence would have. Every caller has
 * a reason — over quota, period locked, read-only replica, maintenance — and
 * being made to pass it is the point.
 *
 * `until` turns "you cannot save" into "you cannot save until 14:00", which is
 * the difference between waiting and giving up. Rendered as a real `<time>`.
 *
 * `role="alert"`, unlike the offline strip: this one fires in response to
 * something the reader just tried to do, and interrupting is correct when they
 * are waiting to find out whether it worked.
 */
export function WriteBlocked({ reason, until, onRetry, className }: {
  /** Why writes are refused. Required — an unexplained block reads as a bug. */
  reason: string;
  /** When it lifts, if that is known. */
  until?: string | number | Date;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert"
      className={cn("flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4", className)}>
      <p className="text-sm font-medium">Changes can&apos;t be saved right now</p>
      <p className="text-sm text-muted-foreground">
        {reason}
        {until ? <> Until <DateFormat date={until} withTime />.</> : null}
      </p>
      {onRetry && (
        <div><Button size="sm" variant="outline" onClick={onRetry}>Try again</Button></div>
      )}
    </div>
  );
}
