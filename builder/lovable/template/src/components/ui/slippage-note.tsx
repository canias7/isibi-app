import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * "Was Tuesday, now Friday — 3 days later."
 *
 * The date moved, and the ORIGINAL IS KEPT VISIBLE. A schedule that silently
 * overwrites its own dates makes a project that has slipped three weeks look
 * exactly like one that was always going to finish then — which is how a
 * fortnightly status meeting learns nothing.
 *
 * The size of the move is stated in days, computed here because it is the whole
 * point and leaving it to the caller invites two components disagreeing about
 * the same pair of dates.
 *
 * EARLIER IS ALSO A MOVE. Most implementations only handle "later", and a
 * delivery pulled forward by four days is just as much a thing people need to
 * be told — often more, since somebody has to be ready for it.
 *
 * Same-day changes render nothing, so a caller can leave this in place through
 * a reschedule that did not actually move the date.
 */
export function SlippageNote({ was, now, className }: {
  was: string | number | Date;
  now: string | number | Date;
  className?: string;
}) {
  const a = new Date(was).getTime(), b = new Date(now).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const days = Math.round((b - a) / 86_400_000);
  if (days === 0) return null;

  return (
    <p className={cn("text-sm", className)}>
      <span className="text-muted-foreground line-through">
        <DateFormat date={a} />
      </span>{" "}
      <span className="font-medium">
        <DateFormat date={b} />
      </span>{" "}
      <span className="text-muted-foreground tabular-nums">
        — {Math.abs(days)} {Math.abs(days) === 1 ? "day" : "days"} {days > 0 ? "later" : "earlier"}
      </span>
    </p>
  );
}
