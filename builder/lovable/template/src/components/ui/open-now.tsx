import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/status-dot";
/**
 * "Open now — until 6pm" / "Closed — opens 9am tomorrow."
 *
 * `OpeningHours` shows the WEEK; this answers the only question most visitors
 * have, which is whether they can come now. Both exist because a table of
 * seven rows does not answer it at a glance.
 *
 * Hours are `"HH:MM"` in 24-hour form and days are 0-6 with 0 = Sunday,
 * matching `Date.getDay()`, so the comparison needs no lookup table.
 *
 * A window whose close is before its open (22:00–02:00) is treated as running
 * past midnight rather than as a mistake — late-opening places exist, and the
 * naive comparison marks them closed all evening.
 */
export function OpenNow({ hours, now, className }: {
  hours: { day: number; open: string; close: string }[];
  now?: Date; className?: string;
}) {
  const d = now ?? new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  const toM = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const dayName = (n: number) =>
    new Date(2024, 0, 7 + n).toLocaleDateString(undefined, { weekday: "long" });   // 2024-01-07 was a Sunday
  const fmt = (s: string) => {
    const m = toM(s);
    if (m == null) return s;
    return new Date(2000, 0, 1, Math.floor(m / 60), m % 60)
      .toLocaleTimeString(undefined, { hour: "numeric", minute: m % 60 ? "2-digit" : undefined });
  };

  for (const h of hours) {
    const o = toM(h.open), c = toM(h.close);
    if (o == null || c == null) continue;
    const overnight = c <= o;
    // Today's window, and yesterday's if it ran past midnight.
    if (h.day === d.getDay() && (overnight ? mins >= o : mins >= o && mins < c)) {
      return <span data-slot="open-now" className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
        <StatusDot state="on" label="Open now" />
        <span className="text-muted-foreground">until {fmt(h.close)}</span>
      </span>;
    }
    if (overnight && h.day === (d.getDay() + 6) % 7 && mins < c) {
      return <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
        <StatusDot state="on" label="Open now" />
        <span className="text-muted-foreground">until {fmt(h.close)}</span>
      </span>;
    }
  }
  // Not open — find the next opening, searching forward a week.
  for (let step = 0; step < 8; step++) {
    const day = (d.getDay() + step) % 7;
    const todays = hours.filter((h) => h.day === day)
      .map((h) => ({ h, o: toM(h.open) }))
      .filter((x): x is { h: typeof hours[number]; o: number } => x.o != null && (step > 0 || x.o > mins))
      .sort((a, b) => a.o - b.o);
    if (todays.length) {
      const next = todays[0].h;
      const when = step === 0 ? "today" : step === 1 ? "tomorrow" : dayName(day);
      return <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
        <StatusDot state="off" label="Closed" />
        <span className="text-muted-foreground">opens {fmt(next.open)} {when}</span>
      </span>;
    }
  }
  return <StatusDot state="off" label="Closed" className={className} />;
}
