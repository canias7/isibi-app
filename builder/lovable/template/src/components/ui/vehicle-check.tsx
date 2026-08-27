import { cn } from "@/lib/utils";
/**
 * The daily walkaround — with defects separated into stop and report.
 *
 * A DEFECT DOES NOT ALWAYS STOP THE VEHICLE and treating every one as a
 * stopper means drivers stop reporting them. A broken mirror is a stop; a torn
 * seat is a report. Making that distinction explicit is what keeps the check
 * honest.
 *
 * A NIL DEFECT REPORT IS STILL A REPORT. Recording that a check was done and
 * found nothing is a legal requirement in many places, and a system that only
 * stores defects cannot prove the check happened at all.
 *
 * THE DRIVER'S NAME AND THE TIME ARE THE RECORD. A check attributed to nobody
 * is worthless in an investigation, and a check recorded at 09:00 on a vehicle
 * that left at 06:00 is worse than none.
 *
 * PREVIOUS OPEN DEFECTS ARE SHOWN, because a driver taking a vehicle needs to
 * know what somebody reported yesterday — otherwise it is reported again, or
 * assumed fixed.
 */
export type VehicleDefect = { id: string; item: string; note?: string; stops?: boolean; reportedOn?: string };

export function VehicleCheck({ vehicle, by, at, defects = [], openFromBefore = [], className }: {
  vehicle: string;
  by?: string;
  /** Free text — "06:10". */
  at?: string;
  /** Found today. */
  defects?: VehicleDefect[];
  /** Still open from earlier checks. */
  openFromBefore?: VehicleDefect[];
  className?: string;
}) {
  const stoppers = [...defects, ...openFromBefore].filter((d) => d.stops);
  return (
    <div data-slot="vehicle-check" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium">{vehicle}</span>
        <span className="block text-xs text-muted-foreground">
          {by ? `Checked by ${by}` : "No driver recorded"}
          {at && ` at ${at}`}
        </span>
      </p>
      {stoppers.length > 0 ? (
        <p className="text-sm font-medium">
          {stoppers.length} {stoppers.length === 1 ? "defect stops" : "defects stop"} this vehicle going out.
        </p>
      ) : defects.length === 0 && openFromBefore.length === 0 ? (
        <p className="text-sm text-muted-foreground">Checked and nothing found.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Defects reported — none stop the vehicle.</p>
      )}
      {[...defects, ...openFromBefore].length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {[...defects, ...openFromBefore].map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className={cn("block", d.stops && "font-medium")}>{d.item}</span>
                {(d.note || d.reportedOn) && (
                  <span className="block text-xs text-muted-foreground">
                    {d.note}
                    {d.note && d.reportedOn ? " · " : ""}
                    {d.reportedOn && `reported ${d.reportedOn}`}
                  </span>
                )}
              </span>
              <span className={cn("shrink-0 text-xs", d.stops ? "font-medium" : "text-muted-foreground")}>
                {d.stops ? "Stops the vehicle" : "Report only"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
