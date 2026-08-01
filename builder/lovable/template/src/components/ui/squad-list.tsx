import { cn } from "@/lib/utils";
/**
 * Who is playing — and who is available but not picked.
 *
 * SUSPENDED AND INJURED ARE SHOWN, NOT HIDDEN. A player omitted silently looks
 * dropped, and fielding a suspended player is a forfeited match — the one
 * selection error that costs points rather than pride.
 *
 * THE SQUAD SIZE IS CHECKED AGAINST THE COMPETITION'S LIMIT. Naming eighteen
 * where sixteen are permitted is discovered by an official on the day, and it
 * is arithmetic a component can do in advance.
 *
 * ELIGIBILITY IS PER COMPETITION. Cup-tied players, registration deadlines and
 * age limits mean a player available for the league is not available for the
 * cup, and a single availability flag cannot express that.
 *
 * SHIRT NUMBERS ARE CHECKED FOR DUPLICATES, because two players in the same
 * number is a delay at kick-off that somebody notices in the changing room five
 * minutes before.
 */
export type SquadPlayer = {
  id: string;
  name: string;
  number?: number;
  position?: string;
  starting?: boolean;
  unavailable?: "injured" | "suspended" | "not-registered" | "cup-tied";
  note?: string;
};

const WHY: Record<NonNullable<SquadPlayer["unavailable"]>, string> = {
  injured: "Injured",
  suspended: "Suspended",
  "not-registered": "Not registered",
  "cup-tied": "Cup-tied",
};

export function SquadList({ players, maxSquad, className }: {
  players: SquadPlayer[];
  /** What the competition permits. */
  maxSquad?: number;
  className?: string;
}) {
  const named = players.filter((p) => !p.unavailable);
  const out = players.filter((p) => p.unavailable);
  const numbers = named.map((p) => p.number).filter((n): n is number => n !== undefined);
  const duplicates = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))];
  const overSquad = maxSquad !== undefined && named.length > maxSquad;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className={cn(overSquad && "font-medium")}>{named.length} named</span>
        {maxSquad !== undefined && <span className="text-muted-foreground"> of {maxSquad} permitted</span>}
      </p>
      {overSquad && maxSquad !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          {named.length - maxSquad} too many — an official will pick who sits out if you do not.
        </p>
      )}
      {duplicates.length > 0 && (
        <p className="text-xs font-medium tabular-nums">
          Two players in number {duplicates.join(" and ")}.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {[...named, ...out].map((p) => (
          <li key={p.id} className="flex items-baseline gap-3 px-3 py-1.5">
            {p.number !== undefined && (
              <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{p.number}</span>
            )}
            <span className={cn("min-w-0 flex-1", p.unavailable && "text-muted-foreground")}>
              {p.name}
              {p.position && <span className="text-xs text-muted-foreground"> · {p.position}</span>}
              {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
            </span>
            <span className={cn("shrink-0 text-xs", p.unavailable ? "font-medium" : "text-muted-foreground")}>
              {p.unavailable ? WHY[p.unavailable] : p.starting ? "Starting" : "Substitute"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
