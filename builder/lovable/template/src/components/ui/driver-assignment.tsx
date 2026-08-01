import { cn } from "@/lib/utils";
/**
 * Who is driving what — with the hours they have left.
 *
 * DRIVING HOURS ARE A LEGAL LIMIT AND THE REASON THIS EXISTS. Assigning a run
 * to somebody with two hours left on their day is a plan that fails at the
 * roadside, and the hours live in a tachograph nobody checks while planning.
 *
 * THE LICENCE CATEGORY IS CHECKED AGAINST THE VEHICLE. A driver licensed for a
 * rigid and assigned an articulated unit is a prohibition and an insurance
 * void, and it is an easy assignment to make from a name alone.
 *
 * "AVAILABLE" IS NOT THE SAME AS "LEGAL TO DRIVE THIS". Somebody on shift, with
 * hours left, whose licence does not cover the vehicle is available and
 * unusable — and a planner sees only the first.
 *
 * THE VEHICLE'S OWN CHECKS ARE SHOWN HERE, because an assignment is where a
 * driver and a vehicle meet, and a defect or an expired inspection stops the
 * run regardless of who is driving.
 */
export function DriverAssignment({ driver, vehicle, hoursLeft, licenceCategories = [], vehicleNeeds, vehicleDefect, inspectionOverdue, className }: {
  driver: string;
  vehicle?: string;
  /** Driving hours remaining today. */
  hoursLeft?: number;
  /** What they are licensed for. */
  licenceCategories?: string[];
  /** What the vehicle requires. */
  vehicleNeeds?: string;
  /** An open defect on the vehicle. */
  vehicleDefect?: string;
  inspectionOverdue?: boolean;
  className?: string;
}) {
  const licensed = !vehicleNeeds || licenceCategories.includes(vehicleNeeds);
  const short = hoursLeft !== undefined && hoursLeft < 2;
  const blocked = !licensed || Boolean(vehicleDefect) || Boolean(inspectionOverdue);
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {driver}
          {vehicle && <span className="text-muted-foreground"> · {vehicle}</span>}
        </span>
        {hoursLeft !== undefined && (
          <span className={cn("shrink-0 text-xs tabular-nums", short ? "font-medium" : "text-muted-foreground")}>
            {hoursLeft}h driving left
          </span>
        )}
      </p>
      {licenceCategories.length > 0 && (
        <p className={cn("text-xs", licensed ? "text-muted-foreground" : "font-medium")}>
          Licensed for {licenceCategories.join(", ")}
          {!licensed && ` — not ${vehicleNeeds}, which this vehicle needs`}
        </p>
      )}
      {vehicleDefect && <p className="text-xs font-medium">Vehicle defect: {vehicleDefect}</p>}
      {inspectionOverdue && <p className="text-xs font-medium">Vehicle inspection overdue.</p>}
      {blocked && (
        <p className="text-xs text-muted-foreground">This run cannot go out as assigned.</p>
      )}
    </li>
  );
}
