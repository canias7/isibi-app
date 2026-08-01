import { DistanceNote } from "@/components/ui/distance-note";
import { OpeningStatus } from "@/components/ui/opening-status";
import { cn } from "@/lib/utils";
/**
 * Places near here, nearest first, each one choosable.
 *
 * IT SAYS WHAT "NEAR" IS MEASURED FROM. A list ordered by distance with no
 * stated origin is untrustworthy — somebody who declined the location prompt
 * sees an order they cannot explain, and nothing tells them the list is sorted
 * from a town centre they have never been to.
 *
 * IT DOES NOT SORT. The order is the caller's, because distance is one ranking
 * and "open now" is another, and a component that quietly re-sorts what it is
 * given will fight whatever the caller decided.
 *
 * OPENING STATE SITS BESIDE THE DISTANCE, since the nearest closed branch is
 * worse than a slightly further open one — that is the entire decision somebody
 * is making with this list, and it needs both facts on the same row.
 *
 * A `<ul>` OF BUTTONS, one per place, whole row as the target. Rows composed of
 * a title link plus a distance are a phone-sized needle to hit.
 */
export type NearbyPlace = {
  id: string;
  name: string;
  address?: string;
  meters?: number | null;
  state?: "open" | "closing" | "closed";
  until?: string;
};

export function NearbyList({ places, onSelect, origin, unit = "km", emptyNote = "Nothing found near here", className }: {
  places: NearbyPlace[];
  onSelect?: (id: string) => void;
  /** What distances are measured from — "your location", "Old Street". */
  origin?: string;
  unit?: "km" | "mi";
  emptyNote?: string;
  className?: string;
}) {
  if (!places.length) return <p className={cn("text-sm text-muted-foreground", className)}>{emptyNote}</p>;
  return (
    <div className={cn("space-y-1.5", className)}>
      {origin && <p className="text-xs text-muted-foreground">Distances from {origin}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {places.map((p) => {
          const body = (
            <span className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.name}</span>
                {p.address && <span className="block text-xs text-muted-foreground">{p.address}</span>}
                {p.state && <OpeningStatus state={p.state} until={p.until} className="text-xs" />}
              </span>
              <DistanceNote meters={p.meters} unit={unit} className="shrink-0 text-xs" />
            </span>
          );
          return (
            <li key={p.id}>
              {onSelect
                ? <button type="button" onClick={() => onSelect(p.id)} className="flex w-full hover:bg-muted/40">{body}</button>
                : <span className="flex w-full">{body}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
