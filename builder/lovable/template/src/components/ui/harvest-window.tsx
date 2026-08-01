import { cn } from "@/lib/utils";
/**
 * When a crop is ready, judged by moisture rather than by date.
 *
 * MOISTURE DECIDES, NOT THE CALENDAR. Cutting above the storage threshold means
 * drying, which costs money per point; cutting below it means shatter losses in
 * the field. The target number and the current reading are the whole decision,
 * and a date-based window cannot express it.
 *
 * THE DRYING COST IS STATED, because the alternative to waiting is paying — and
 * the choice between a wet forecast and a drying bill is arithmetic somebody
 * makes standing in a field on a phone.
 *
 * THE PRE-HARVEST INTERVAL IS SHOWN. A crop sprayed within the interval cannot
 * legally be harvested, and it is the constraint that turns a good weather
 * window into an illegal one — held in a spray record nobody has open.
 *
 * READINGS ARE DATED. Grain moisture changes by several points in a day, and a
 * three-day-old reading is not a basis for starting a combine.
 */
export function HarvestWindow({ crop, moisture, targetMoisture, readingOn, dryingCost, sprayIntervalUntil, className }: {
  crop: string;
  /** Current reading, percent. */
  moisture?: number;
  /** Storage threshold, percent. */
  targetMoisture?: number;
  /** Free text — "this morning". */
  readingOn?: string;
  /** What drying costs — "£9 a tonne per point". */
  dryingCost?: string;
  /** Free text — cannot harvest until this date. */
  sprayIntervalUntil?: string;
  className?: string;
}) {
  const wet = moisture !== undefined && targetMoisture !== undefined && moisture > targetMoisture;
  const points = wet ? Math.round((moisture! - targetMoisture!) * 10) / 10 : 0;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{crop}</span>
        {moisture !== undefined && (
          <>
            <span className="text-muted-foreground"> · </span>
            <span className="tabular-nums">{moisture}%</span>
            {targetMoisture !== undefined && (
              <span className="text-muted-foreground tabular-nums"> against {targetMoisture}% for storage</span>
            )}
          </>
        )}
      </p>
      {wet && (
        <p className="text-xs">
          <span className="font-medium">{points} points too wet</span>
          {dryingCost && <span className="text-muted-foreground"> — drying costs {dryingCost}</span>}
        </p>
      )}
      {sprayIntervalUntil && (
        <p className="text-xs font-medium">Cannot be harvested until {sprayIntervalUntil} — spray interval.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {readingOn ? `Read ${readingOn}` : "No reading date — moisture moves several points in a day"}
      </p>
    </div>
  );
}
