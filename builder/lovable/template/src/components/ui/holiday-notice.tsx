import { DateFormat } from "@/components/ui/date-format";
import { CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Closed 24–27 December."
 *
 * It hides itself once the closure is over, which is the only thing that
 * matters here: a Christmas notice still on a site in March is the clearest
 * possible signal that nobody is looking after it, and it is left up by
 * every business that has to remember to take it down.
 *
 * It appears `showDaysBefore` ahead of time — three weeks by default — so it
 * is not on the page all year either.
 */
export function HolidayNotice({ from, to, reason = "We're closed", note, showDaysBefore = 21, className }: {
  from: string | number | Date; to?: string | number | Date | null;
  reason?: string; note?: string; showDaysBefore?: number; className?: string;
}) {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const end = to ? new Date(to) : start;
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);
  const now = Date.now();
  if (now > endOfDay.getTime()) return null;                                   // over
  if (start.getTime() - now > showDaysBefore * 86_400_000) return null;        // too far off
  return (
    <div data-slot="holiday-notice" className={cn("flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5", className)}>
      <CalendarOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="text-sm">
        <p className="font-medium">
          {reason} <DateFormat date={start} />
          {to && end.toDateString() !== start.toDateString() && <> – <DateFormat date={end} /></>}
        </p>
        {note && <p className="mt-0.5 text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
