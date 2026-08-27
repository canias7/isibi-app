import { cn } from "@/lib/utils";
/**
 * Top the pick face up from bulk — before it runs dry, not after.
 *
 * THE TRIGGER IS "WILL RUN OUT", NOT "IS EMPTY". A pick face that empties stops
 * every order needing that line, and the replenishment takes fifteen minutes.
 * So the useful figure is cover — how many picks are left at the current rate —
 * and the caller supplies it because only they know the rate.
 *
 * IT REFUSES TO ASK FOR MORE THAN THE FACE HOLDS. A replenishment of 200 into a
 * bin that fits 60 is a task that cannot be completed, and the operator either
 * abandons it or leaves 140 on the floor beside it.
 *
 * BULK AVAILABILITY IS CHECKED HERE. Sending somebody to a bulk location with
 * nothing in it is the single most common wasted trip in a warehouse, and the
 * component says so rather than letting them find out.
 *
 * URGENCY IS COVER, WRITTEN OUT — "about 40 minutes of picking left" rather than
 * a colour, which cannot be read in a printed run sheet or by everybody.
 */
export function ReplenishTask({ item, pickFace, bulkLocation, faceQuantity, faceCapacity, bulkAvailable, coverNote, className }: {
  item: string;
  /** The pick face being topped up. */
  pickFace: string;
  /** Where the stock is coming from. */
  bulkLocation?: string;
  /** What is in the face now. */
  faceQuantity: number;
  /** What the face holds when full. */
  faceCapacity: number;
  /** What bulk actually has. */
  bulkAvailable?: number;
  /** Free text — "about 40 minutes of picking left". */
  coverNote?: string;
  className?: string;
}) {
  const room = Math.max(0, faceCapacity - faceQuantity);
  const move = bulkAvailable === undefined ? room : Math.min(room, bulkAvailable);
  const shortInBulk = bulkAvailable !== undefined && bulkAvailable < room;
  return (
    <li data-slot="replenish-task" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{item}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {faceQuantity} of {faceCapacity} in the face
        </span>
      </p>
      <p className="text-xs">
        <span className="text-muted-foreground">Move </span>
        <span className="font-medium tabular-nums">{move}</span>
        {bulkLocation && (
          <>
            <span className="text-muted-foreground"> from </span>
            <span className="font-mono">{bulkLocation}</span>
          </>
        )}
        <span className="text-muted-foreground"> to </span>
        <span className="font-mono">{pickFace}</span>
      </p>
      {coverNote && <p className="text-xs font-medium">{coverNote}</p>}
      {bulkAvailable === 0 ? (
        <p className="text-xs font-medium">Bulk is empty — this cannot be replenished.</p>
      ) : shortInBulk ? (
        <p className="text-xs font-medium tabular-nums">
          Bulk holds {bulkAvailable} — the face will still be {room - move} short.
        </p>
      ) : null}
    </li>
  );
}
