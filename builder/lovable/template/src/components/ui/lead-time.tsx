import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Order by 2pm for next-day delivery" — and what happens after that.
 *
 * The message CHANGES once the cutoff has passed rather than sitting there
 * saying something that is no longer true. A page still promising next-day at
 * 4pm is a promise the business then has to break.
 *
 * `cutoffHour` is local to the reader, which is a deliberate simplification:
 * a small business's cutoff is in its own timezone, and the caller passes the
 * hour it means. For a shop selling across timezones, pass a resolved value.
 */
export function LeadTime({ cutoffHour, cutoffMinute = 0, before, after, now, className }: {
  cutoffHour: number; cutoffMinute?: number;
  before: string; after: string; now?: Date; className?: string;
}) {
  const d = now ?? new Date();
  const past = d.getHours() * 60 + d.getMinutes() >= cutoffHour * 60 + cutoffMinute;
  const time = new Date(2000, 0, 1, cutoffHour, cutoffMinute)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: cutoffMinute ? "2-digit" : undefined });
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", past ? "text-muted-foreground" : "text-foreground", className)}>
      <Clock className="size-3.5 shrink-0" />
      {past ? after : <>Order by <strong className="font-medium">{time}</strong> {before}</>}
    </p>
  );
}
