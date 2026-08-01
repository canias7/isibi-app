import { cn } from "@/lib/utils";
/**
 * How busy each person is, so work can be moved before somebody drowns.
 *
 * IT SORTS BY NOTHING AND SHOWS EVERYONE. A leaderboard of the busiest hides
 * the person with nothing to do, who is the answer to the problem the busiest
 * person has. Both ends of the list are the useful part.
 *
 * "AT CAPACITY" AND "OVER" ARE DIFFERENT AND BOTH ARE NAMED. Full is fine —
 * that is a well-planned day; over is somebody working through their break, and
 * a bar that saturates at 100% cannot tell them apart.
 *
 * UNAVAILABLE PEOPLE ARE SHOWN, MARKED, NOT HIDDEN. Somebody on leave with a
 * half-full day is the commonest cause of "why did nobody notice" — their
 * bookings still exist and somebody has to cover them.
 *
 * BARS ARE `aria-hidden` WITH THE NUMBERS IN TEXT, since a row of proportional
 * fills is the least accessible way to convey a set of small integers.
 */
export type StaffLoadRow = {
  id: string;
  name: string;
  booked: number;
  capacity: number;
  away?: boolean;
  note?: string;
};

export function StaffLoad({ people, unit = "jobs", className }: {
  people: StaffLoadRow[];
  unit?: string;
  className?: string;
}) {
  if (!people.length) return null;
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border", className)}>
      {people.map((p) => {
        const over = p.booked > p.capacity;
        const full = !over && p.booked === p.capacity && p.capacity > 0;
        const pct = p.capacity > 0 ? Math.min(100, (p.booked / p.capacity) * 100) : 0;
        return (
          <li key={p.id} className="space-y-1 px-3 py-2 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("min-w-0 flex-1", p.away && "text-muted-foreground")}>
                {p.name}
                {p.away && <span className="text-xs"> · away</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {p.booked.toLocaleString()}<span className="text-muted-foreground">/{p.capacity.toLocaleString()} {unit}</span>
              </span>
              {(over || full) && (
                <span className="shrink-0 text-xs font-medium">
                  {over ? `${p.booked - p.capacity} over` : "Full"}
                </span>
              )}
            </p>
            <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full border border-border">
              <span style={{ width: `${pct}%` }}
                className={cn("block h-full",
                  over ? "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_3px,transparent_3px_6px)]" : "bg-foreground")} />
            </div>
            {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
