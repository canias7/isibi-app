import { cn } from "@/lib/utils";
/**
 * "1.2 km away" — how far something is, with the precision it deserves.
 *
 * IT ROUNDS TO SOMETHING BELIEVABLE. A distance computed from two coordinates
 * comes out as 1.2384 km, and printing that claims a precision that is nonsense
 * for a place with a car park — under a kilometre it reads in metres, above it
 * to one decimal, and over ten to the whole number.
 *
 * "FROM WHERE" IS OPTIONAL BUT SUPPORTED, because a bare distance in a list is
 * meaningless when the reader has not told the site where they are. `from`
 * makes it "1.2 km from Old Street" rather than from an origin nobody named.
 *
 * VERY CLOSE READS AS "NEARBY", not "0.0 km". Zero-point-zero looks like
 * missing data, and below about 50 metres the coordinate noise exceeds the
 * distance anyway.
 *
 * NULL RENDERS NOTHING. A distance is only known when the reader has shared a
 * location, so absent is the normal case and "— km" on every card is worse
 * than a card with no distance line.
 */
export function DistanceNote({ meters, unit = "km", from, nearbyUnder = 50, className }: {
  /** Distance in metres. null when unknown. */
  meters: number | null | undefined;
  unit?: "km" | "mi";
  /** Name of the origin — "Old Street". */
  from?: string;
  /** Below this many metres it reads as "nearby". */
  nearbyUnder?: number;
  className?: string;
}) {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  let text: string;
  if (meters < nearbyUnder) text = "Nearby";
  else if (unit === "mi") {
    const mi = meters / 1609.344;
    text = mi < 0.1 ? `${Math.round(meters / 0.9144)} yd`
      : mi < 10 ? `${mi.toFixed(1)} mi away`
      : `${Math.round(mi)} mi away`;
  } else {
    text = meters < 1000 ? `${Math.round(meters / 10) * 10} m away`
      : meters < 10000 ? `${(meters / 1000).toFixed(1)} km away`
      : `${Math.round(meters / 1000)} km away`;
  }
  return (
    <span data-slot="distance-note" className={cn("text-sm text-muted-foreground", className)}>
      {text}
      {from && text !== "Nearby" && <span> from {from}</span>}
    </span>
  );
}
