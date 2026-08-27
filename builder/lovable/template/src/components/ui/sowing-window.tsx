import { cn } from "@/lib/utils";
/**
 * When a crop can be sown, and what is lost by sowing late.
 *
 * THE YIELD PENALTY IS THE DECISION. Every crop has a window and a curve inside
 * it — sowing a fortnight late costs a measurable percentage — and a component
 * showing only start and end dates gives no basis for choosing between sowing
 * in poor conditions now and waiting for better ones.
 *
 * SOIL CONDITIONS OVERRIDE THE CALENDAR and it says so. Drilling into wet
 * ground does more damage than a late sowing, and a window presented as a
 * deadline pushes people to do exactly that.
 *
 * "OPTIMUM" IS DISTINCT FROM "POSSIBLE". Both are real and the gap between them
 * is where most sowing actually happens, so collapsing them into one range
 * loses the information.
 *
 * IT NAMES THE VARIETY, because windows differ between varieties of the same
 * crop by weeks — and the generic crop window is the one that gets used.
 */
export function SowingWindow({ crop, variety, optimumFrom, optimumTo, latestOn, yieldPenalty, soilNote, className }: {
  crop: string;
  variety?: string;
  /** Free text — "10 September". */
  optimumFrom?: string;
  optimumTo?: string;
  /** Latest it can go in at all. */
  latestOn?: string;
  /** What late sowing costs — "about 1% a day after 10 October". */
  yieldPenalty?: string;
  /** Conditions caveat. */
  soilNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="sowing-window" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{crop}</span>
        {variety && <span className="text-muted-foreground"> · {variety}</span>}
      </p>
      {(optimumFrom || optimumTo) && (
        <p className="text-xs">
          <span className="text-muted-foreground">Best: </span>
          {optimumFrom && optimumTo ? `${optimumFrom} to ${optimumTo}` : optimumFrom ?? optimumTo}
        </p>
      )}
      {latestOn && (
        <p className="text-xs">
          <span className="text-muted-foreground">Latest: </span>{latestOn}
        </p>
      )}
      {yieldPenalty && <p className="text-xs text-muted-foreground">Sowing late costs {yieldPenalty}.</p>}
      <p className="text-xs text-muted-foreground">
        {soilNote ?? "Conditions beat the calendar — drilling into wet ground costs more than sowing a week late."}
      </p>
    </div>
  );
}
