import { cn } from "@/lib/utils";
/**
 * A crew member's duty — with the rest that has to precede it.
 *
 * REST BEFORE DUTY IS A HARD LIMIT AND IS CHECKED HERE. Duty and flight-time
 * limits exist because fatigue kills, they are the constraint every roster is
 * built around, and a roster showing only the duty is missing the one thing that
 * makes it legal.
 *
 * DUTY IS LONGER THAN THE FLIGHT OR THE VOYAGE. Report time to release is what
 * the limit applies to, and a roster measuring block hours understates it by
 * hours every day.
 *
 * QUALIFICATION AND RECENCY EXPIRIES ARE SHOWN AGAINST THE DUTY. A lapsed
 * medical or an out-of-recency licence means the person cannot operate, and it
 * is knowable weeks ahead rather than at the gate.
 *
 * IT DOES NOT COMPUTE THE LIMIT ITSELF. Limits vary by operation, by regulator
 * and by acclimatisation state; a component inventing one would be confidently
 * wrong about the thing that matters most.
 */
export function CrewRosterRow({ name, role, duty, reportAt, releaseAt, dutyMinutes, restBeforeMinutes, minimumRestMinutes, qualificationExpiry, qualificationLapsed, className }: {
  name: string;
  role?: string;
  /** "LHR–JFK, BA117" or "Voyage 214". */
  duty?: string;
  /** Free text — "06:40". */
  reportAt?: string;
  releaseAt?: string;
  /** Report to release, not block hours. */
  dutyMinutes?: number;
  /** Rest actually taken before this duty. */
  restBeforeMinutes?: number;
  /** Supplied by the caller — the limit is not computed here. */
  minimumRestMinutes?: number;
  /** Free text — "medical expires 14 September". */
  qualificationExpiry?: string;
  qualificationLapsed?: boolean;
  className?: string;
}) {
  // "12h 0m" is noise on a limit somebody is checking against — an exact number
  // of hours reads as hours. Same rule as `routing-step`.
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h}h` : `${h}h ${r}m`;
  };
  const shortRest =
    restBeforeMinutes !== undefined &&
    minimumRestMinutes !== undefined &&
    restBeforeMinutes < minimumRestMinutes;
  return (
    <li data-slot="crew-roster-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {name}
          {role && <span className="text-muted-foreground"> · {role}</span>}
          {duty && <span className="block text-xs text-muted-foreground">{duty}</span>}
        </span>
        {(reportAt || releaseAt) && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {[reportAt, releaseAt].filter(Boolean).join(" – ")}
          </span>
        )}
      </p>
      {dutyMinutes !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {fmt(dutyMinutes)} on duty, report to release — not block hours.
        </p>
      )}
      {restBeforeMinutes !== undefined && (
        <p className={cn("text-xs tabular-nums", shortRest ? "font-medium" : "text-muted-foreground")}>
          {fmt(restBeforeMinutes)} rest before this duty
          {minimumRestMinutes !== undefined && ` · minimum ${fmt(minimumRestMinutes)}`}
          {shortRest && " — this duty cannot be operated as rostered"}
        </p>
      )}
      {qualificationExpiry && (
        <p className={cn("text-xs", qualificationLapsed ? "font-medium" : "text-muted-foreground")}>
          {qualificationExpiry}
          {qualificationLapsed && " — lapsed. They cannot operate."}
        </p>
      )}
    </li>
  );
}
