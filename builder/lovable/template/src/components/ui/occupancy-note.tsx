import { cn } from "@/lib/utils";
/**
 * How busy the space is — with the part that actually predicts it.
 *
 * THE USUAL PATTERN MATTERS MORE THAN THE CURRENT NUMBER. Somebody deciding
 * whether to come in at nine wants to know what nine is normally like, not what
 * seven o'clock is like right now. The typical figure for the time being asked
 * about is the useful one and is almost never shown.
 *
 * IT IS A COUNT OF PEOPLE, NOT A PERCENTAGE ALONE. "78% full" is meaningless
 * without knowing the size, and the two numbers together answer both "is it
 * busy" and "will I get a desk".
 *
 * QUIET IS REPORTED AS QUIET, not as a problem. Spaces hide low occupancy
 * because it looks like failure, and the member who wants a quiet day is exactly
 * the person the number would have helped.
 *
 * NO LIVE CAMERA AND NO PER-DESK MAP. Both turn a capacity figure into
 * monitoring of individuals, at a level of detail nobody needed to answer the
 * question.
 */
export function OccupancyNote({ present, capacity, typicalNow, atTime, quietestTime, busiestTime, className }: {
  present: number;
  capacity: number;
  /** What this time of day is normally like. The useful number. */
  typicalNow?: number;
  atTime?: string;
  quietestTime?: string;
  busiestTime?: string;
  className?: string;
}) {
  const pct = capacity > 0 ? Math.round((present / capacity) * 100) : 0;
  const free = Math.max(0, capacity - present);
  const busierThanUsual = typicalNow !== undefined && present > typicalNow * 1.2;
  const quieterThanUsual = typicalNow !== undefined && present < typicalNow * 0.8;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">
          {present} of {capacity} in
        </span>
        <span className="text-muted-foreground">
          {" "}
          · {free} {free === 1 ? "space" : "spaces"} free{atTime ? `, at ${atTime}` : ""}
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-foreground" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {typicalNow !== undefined && (
        <p className={cn("text-xs tabular-nums", busierThanUsual ? "font-medium" : "text-muted-foreground")}>
          {busierThanUsual
            ? `Busier than this time usually is — normally about ${typicalNow}.`
            : quieterThanUsual
              ? `Quieter than usual for this time — normally about ${typicalNow}. A good day for a quiet desk.`
              : `About what this time of day is normally like (${typicalNow}).`}
        </p>
      )}
      {(quietestTime || busiestTime) && (
        <p className="text-xs text-muted-foreground">
          {[quietestTime && `Quietest around ${quietestTime}`, busiestTime && `busiest around ${busiestTime}`]
            .filter(Boolean)
            .join(", ")}
          .
        </p>
      )}
    </div>
  );
}
