import { cn } from "@/lib/utils";
/**
 * What has been done to a machine, and what is due.
 *
 * SERVICE INTERVALS RUN ON HOURS OR DISTANCE AS WELL AS ON DATES, and whichever
 * comes first is what is due. A history that counts only months tells a hire
 * company nothing about the machine that has done four hundred hours since
 * January, which is the one about to fail.
 *
 * A MISSED SERVICE STAYS VISIBLE AFTER THE NEXT ONE IS DONE. The pattern is the
 * information — a machine serviced late three times running is a different asset
 * from one serviced on time, and a list showing only the last entry cannot say
 * which this is.
 *
 * WHO DID IT IS RECORDED. Warranty claims turn on whether a service was done by
 * somebody approved, and it is discovered at the claim rather than at the
 * service.
 *
 * NO OVERALL HEALTH SCORE. It would be one number standing in for a mechanic's
 * judgement, and it would be trusted.
 */
export type ServiceEntry = {
  id: string;
  what: string;
  on: string;
  atHours?: number;
  by?: string;
  /** True where it was done later than it was due. */
  late?: boolean;
};

export function ServiceHistory({ entries, hoursNow, dueAtHours, dueOn, className }: {
  entries: ServiceEntry[];
  hoursNow?: number;
  /** Whichever of the two comes first is what is due. */
  dueAtHours?: number;
  dueOn?: string;
  className?: string;
}) {
  const hoursLeft = hoursNow !== undefined && dueAtHours !== undefined ? dueAtHours - hoursNow : undefined;
  const lateCount = entries.filter((e) => e.late).length;
  return (
    <div data-slot="service-history" className={cn("space-y-1.5 text-sm", className)}>
      {(dueAtHours !== undefined || dueOn) && (
        <p className={cn("tabular-nums", hoursLeft !== undefined && hoursLeft <= 0 ? "font-medium" : "")}>
          {hoursLeft !== undefined && hoursLeft <= 0
            ? `Service overdue by ${Math.abs(hoursLeft)} hours.`
            : `Next service ${[dueAtHours !== undefined && `at ${dueAtHours} hours`, dueOn && `or ${dueOn}`].filter(Boolean).join(" ")} — whichever comes first.`}
          {hoursNow !== undefined && (
            <span className="text-muted-foreground"> Currently on {hoursNow} hours.</span>
          )}
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border">
        {entries.map((e) => (
          <li key={e.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {e.what}
              <span className="block text-xs text-muted-foreground">
                {[e.on, e.atHours !== undefined && `${e.atHours} hours`, e.by].filter(Boolean).join(" · ")}
              </span>
            </span>
            {e.late && <span className="shrink-0 text-xs font-medium">Late</span>}
          </li>
        ))}
      </ul>
      {lateCount >= 2 && (
        <p className="text-xs font-medium tabular-nums">
          {lateCount} of these were done late. That pattern says more about the machine than the last entry does.
        </p>
      )}
      {entries.some((e) => !e.by) && (
        <p className="text-xs text-muted-foreground">
          Some entries have nobody recorded against them. Warranty claims turn on exactly that.
        </p>
      )}
    </div>
  );
}
