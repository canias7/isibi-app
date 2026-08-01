import { cn } from "@/lib/utils";
/**
 * Supply is off — what is known, and when the next update comes.
 *
 * THE TIME OF THE NEXT UPDATE IS THE MOST IMPORTANT FIELD, more than the
 * estimated restoration. People check a status page repeatedly when they do not
 * know when to check again; a promised update time is what lets somebody put
 * the phone down.
 *
 * "WE DO NOT KNOW YET" IS A VALID AND STATED ANSWER. An invented restoration
 * time is worse than none — it is believed, planned around, and missed, and the
 * second estimate is then not believed either.
 *
 * PLANNED AND UNPLANNED READ DIFFERENTLY. A planned outage needs the dates and
 * whether it can be rescheduled; an unplanned one needs the cause and the
 * update time. Presenting them identically fails both.
 *
 * VULNERABLE-CUSTOMER SUPPORT IS SURFACED HERE and not buried in a menu.
 * Somebody dependent on powered medical equipment is reading this page in the
 * dark, and the priority-register number is the whole reason they are.
 */
export function OutageNotice({ area, planned, since, cause, estimatedRestore, nextUpdate, affectedCount, supportNote, className }: {
  area: string;
  planned?: boolean;
  /** Free text — "14:20 today". */
  since?: string;
  cause?: string;
  /** Undefined where it is genuinely unknown. */
  estimatedRestore?: string;
  /** When the next update will be posted. */
  nextUpdate?: string;
  affectedCount?: number;
  /** Priority-register or welfare contact. */
  supportNote?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium">
        {planned ? "Planned work" : "Supply is off"} — {area}
      </p>
      <p className="text-xs text-muted-foreground">
        {since && `Since ${since}`}
        {since && affectedCount !== undefined ? " · " : ""}
        {affectedCount !== undefined && `${affectedCount.toLocaleString()} properties`}
      </p>
      {cause && <p className="text-xs">{cause}</p>}
      <p className={cn("text-xs", estimatedRestore ? "" : "font-medium")}>
        {estimatedRestore
          ? `Expected back by ${estimatedRestore}.`
          : "We do not have a restoration time yet. We will not guess one."}
      </p>
      <p className="text-xs font-medium">
        {nextUpdate ? `Next update at ${nextUpdate}.` : "No update time set — check back when you can."}
      </p>
      {supportNote && <p className="text-xs">{supportNote}</p>}
    </div>
  );
}
