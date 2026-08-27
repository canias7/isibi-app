import { Calendar, Clock, MapPin, Users, Ticket } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * The facts line under an event title.
 *
 * The end time is rendered as a duration when it is on the same day
 * ("7:00 – 9:30pm"), and as a full date when it is not, because "7pm – 2am"
 * with no date is how people turn up on the wrong night.
 */
export function EventMeta({ start, end, venue, capacity, price, className }: {
  start?: string | number | Date; end?: string | number | Date | null;
  venue?: string; capacity?: string; price?: string; className?: string;
}) {
  const s = start != null ? toDate(start) : null;
  const e = end != null ? toDate(end) : null;
  const ok = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());
  const sameDay = ok(s) && ok(e) && s.toDateString() === e.toDateString();
  const time = ok(s)
    ? s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      + (ok(e) ? " – " + (sameDay
          ? e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
          : e.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })) : "")
    : null;
  const bits: [React.ComponentType<{ className?: string }>, string | null][] = [
    [Calendar, ok(s) ? s.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : null],
    [Clock, time],
    [MapPin, venue ?? null],
    [Users, capacity ?? null],
    [Ticket, price ?? null],
  ];
  return (
    <ul data-slot="event-meta" className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground", className)}>
      {bits.filter(([, v]) => v).map(([Icon, v], i) => (
        <li key={i} className="flex items-center gap-1.5"><Icon className="size-3.5" />{v}</li>
      ))}
    </ul>
  );
}
