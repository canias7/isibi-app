import { cn } from "@/lib/utils";
/**
 * Everyone accounted for — with the unaccounted named, loudly.
 *
 * THE ONLY OUTPUT THAT MATTERS IS THE LIST OF PEOPLE NOT HERE. A count is worse
 * than useless at a muster point: "42 of 45" sends somebody back into a building
 * looking for nobody in particular. The names are the whole component and they go
 * at the top in the largest type on the screen.
 *
 * WHERE SOMEBODY WAS LAST SEEN IS CARRIED WITH THE NAME, because it is the
 * difference between a search and a sweep, and it exists in the heads of the
 * people standing outside.
 *
 * VISITORS AND CONTRACTORS ARE IN THE SAME LIST AS STAFF. They are the people
 * most likely to be missed and least likely to know the way out, and they are on
 * a different system in almost every building.
 *
 * NOBODY IS MARKED SAFE AUTOMATICALLY. A badge swipe at a door does not mean
 * somebody left, and a system that infers safety from data produces a muster
 * that is confidently wrong.
 */
export type Person = {
  id: string;
  name: string;
  kind?: "staff" | "visitor" | "contractor";
  accountedFor?: boolean;
  /** The difference between a search and a sweep. */
  lastSeen?: string;
  markedBy?: string;
};

export function MusterList({ people, point, className }: {
  people: Person[];
  point?: string;
  className?: string;
}) {
  const missing = people.filter((p) => !p.accountedFor);
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      {missing.length === 0 ? (
        <p className="text-lg font-medium">Everybody is accounted for.</p>
      ) : (
        <div>
          <p className="text-lg font-medium">
            {missing.length} not accounted for{point ? ` at ${point}` : ""}:
          </p>
          <ul className="mt-1 space-y-0.5">
            {missing.map((p) => (
              <li key={p.id} className="font-medium">
                {p.name}
                {p.kind && p.kind !== "staff" ? ` (${p.kind})` : ""}
                {p.lastSeen && <span className="block text-xs font-normal">Last seen {p.lastSeen}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="divide-y divide-border rounded-md border border-border">
        {people.map((p) => (
          <li key={p.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className={cn("min-w-0 flex-1", !p.accountedFor && "font-medium")}>
              {p.name}
              {p.kind && p.kind !== "staff" && (
                <span className="text-xs text-muted-foreground"> · {p.kind}</span>
              )}
            </span>
            <span className={cn("shrink-0 text-xs", p.accountedFor ? "text-muted-foreground" : "font-medium")}>
              {p.accountedFor ? (p.markedBy ? `Seen by ${p.markedBy}` : "Here") : "Not here"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Somebody has to see each person. A badge at a door does not mean they left the building.
      </p>
    </div>
  );
}
