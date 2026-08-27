import { cn } from "@/lib/utils";
/**
 * Hired plant — what it costs per day, and whether it is earning it.
 *
 * IDLE HIRE IS THE MONEY. A telehandler sitting unused still bills every day,
 * and nobody notices because the hire was arranged three weeks ago by somebody
 * else. Showing days on hire beside days actually used is the whole point.
 *
 * OFF-HIRE IS A DATE SOMEBODY HAS TO ACTION. Hire runs until it is called off,
 * not until the job finishes, and the gap between those two is the commonest
 * avoidable cost on a site. An item with no off-hire date set is flagged.
 *
 * THE INSPECTION DATE MATTERS AS MUCH AS THE COST. Lifting equipment out of
 * test is unusable and often unnoticed until an inspector asks — and the
 * certificate lives in a folder in a cabin.
 *
 * THE RATE AND THE RUNNING TOTAL ARE BOTH SHOWN, because the daily figure is
 * what somebody remembers agreeing and the total is what appears on the
 * invoice.
 */
export function PlantHireRow({ item, supplier, dailyRate, daysOnHire, daysUsed, runningTotal, offHireOn, inspectionDue, className }: {
  item: string;
  supplier?: string;
  /** Pre-formatted. */
  dailyRate?: string;
  daysOnHire?: number;
  /** Days it actually did work. */
  daysUsed?: number;
  /** Pre-formatted. */
  runningTotal?: string;
  /** Free text — "14 August", or absent if not arranged. */
  offHireOn?: string;
  /** Free text — "overdue since 2 May". */
  inspectionDue?: string;
  className?: string;
}) {
  const idle = daysOnHire !== undefined && daysUsed !== undefined ? daysOnHire - daysUsed : null;
  return (
    <li data-slot="plant-hire-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {item}
          {supplier && <span className="text-muted-foreground"> · {supplier}</span>}
        </span>
        <span className="shrink-0 text-end">
          {runningTotal && <span className="block tabular-nums">{runningTotal}</span>}
          {dailyRate && <span className="block text-xs tabular-nums text-muted-foreground">{dailyRate} a day</span>}
        </span>
      </p>
      {idle !== null && (
        <p className={cn("text-xs", idle > 0 ? "font-medium" : "text-muted-foreground")}>
          {idle > 0
            ? `On hire ${daysOnHire} days, used ${daysUsed} — ${idle} idle`
            : `On hire ${daysOnHire} days, used every one`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {offHireOn
          ? `Off hire ${offHireOn}`
          : <span className="font-medium text-foreground">No off-hire date — it keeps billing until somebody calls it off</span>}
        {inspectionDue && <span> · inspection {inspectionDue}</span>}
      </p>
    </li>
  );
}
