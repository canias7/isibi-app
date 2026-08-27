import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Several places, one glance — with the day boundary FLAGGED.
 *
 * "TOMORROW" AND "YESTERDAY" ARE PRINTED when a zone's date differs from
 * the viewer's. The classic scheduling mistake is "9:00 in Sydney" being
 * tomorrow, unstated — a meeting booked a day off. The date comparison
 * uses each zone's own rendered date, so DST and the date line are
 * already accounted for.
 *
 * THE VIEWER'S OWN ROW IS MARKED ("you") and always included at the top
 * — every comparison needs the anchor visible, or the reader supplies a
 * wrong one from memory.
 *
 * One minute tick shared by the whole list, not one per row.
 */
export function WorldClock({ zones, className }: {
  zones: { zone: string; label?: string }[];
  className?: string;
}) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const fmt = (tz?: string) => {
    try {
      return {
        time: new Intl.DateTimeFormat(undefined, { ...(tz ? { timeZone: tz } : {}), hour: "2-digit", minute: "2-digit" }).format(now),
        day: new Intl.DateTimeFormat("en-CA", { ...(tz ? { timeZone: tz } : {}), dateStyle: "short" }).format(now),
      };
    } catch { return null; }
  };
  const here = fmt();

  return (
    <ul data-slot="world-clock" className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      <li className="flex items-baseline justify-between gap-3 px-3 py-1.5">
        <span className="text-sm font-medium">Here <span className="text-xs text-muted-foreground">· you</span></span>
        <span className="text-sm font-medium tabular-nums">{here?.time}</span>
      </li>
      {zones.map(({ zone, label }) => {
        const z = fmt(zone);
        if (!z) return null;
        const dayNote = here && z.day !== here.day
          ? (z.day > here.day ? "tomorrow" : "yesterday")
          : null;
        return (
          <li key={zone} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="text-sm">{label ?? zone.split("/").pop()?.replace(/_/g, " ")}</span>
            <span className="text-sm tabular-nums">
              {z.time}
              {/* The day boundary is the trap; it gets words, not fine print. */}
              {dayNote ? <span className="ms-1.5 text-xs font-medium">{dayNote}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
