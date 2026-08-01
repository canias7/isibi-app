import { cn } from "@/lib/utils";
/**
 * When to order more, judged against the lead time rather than a bare minimum.
 *
 * THE LEAD TIME IS WHAT MAKES A REORDER POINT MEAN ANYTHING. "12 left, minimum
 * 10" looks comfortable and is not, if the supplier takes three weeks and the
 * shop sells four a day. Days-of-cover is the number that decides, and it is
 * the number almost no stock screen shows.
 *
 * IT SAYS "ORDER NOW" ONLY WHEN THE COVER IS SHORTER THAN THE WAIT, which is
 * the actual condition — a level above the minimum can still be too late, and a
 * level below it can be fine for something that arrives tomorrow.
 *
 * DAYS OF COVER IS OMITTED, NOT GUESSED, when there is no usage rate. A cover
 * figure invented from an assumed rate is worse than none: it looks measured.
 *
 * WORDS, WEIGHT AND AN ARROW rather than a red badge — a stock report is the
 * archetypal printed-and-emailed screen.
 */
export function ReorderPoint({ onHand, perDay, leadDays, minimum, unit = "units", className }: {
  onHand: number;
  /** Average used per day. Omit if unknown. */
  perDay?: number;
  /** Days the supplier takes. */
  leadDays?: number;
  /** A flat floor, if the caller keeps one. */
  minimum?: number;
  unit?: string;
  className?: string;
}) {
  const cover = perDay && perDay > 0 ? Math.floor(onHand / perDay) : null;
  const late = cover !== null && leadDays !== undefined && cover < leadDays;
  const belowMin = minimum !== undefined && onHand <= minimum;
  const act = late || belowMin;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium tabular-nums">{onHand.toLocaleString()}</span>
        <span className="text-muted-foreground"> {unit} on hand</span>
        {cover !== null && (
          <span className="text-muted-foreground"> · about {cover} {cover === 1 ? "day" : "days"} of cover</span>
        )}
      </p>
      {act && (
        <p className="font-medium">
          <span aria-hidden="true">→ </span>
          Order now
          <span className="font-normal text-muted-foreground">
            {late && leadDays !== undefined
              ? ` — the supplier takes ${leadDays} days and you have ${cover}.`
              : minimum !== undefined ? ` — at or below your minimum of ${minimum.toLocaleString()}.` : ""}
          </span>
        </p>
      )}
      {!act && leadDays !== undefined && cover !== null && (
        <p className="text-xs text-muted-foreground">Supplier takes {leadDays} days.</p>
      )}
    </div>
  );
}
