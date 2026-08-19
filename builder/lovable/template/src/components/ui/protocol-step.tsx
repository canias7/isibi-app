import { cn } from "@/lib/utils";
/**
 * One step of a method — with the tolerance, not just the number.
 *
 * A TIME OR TEMPERATURE WITHOUT A TOLERANCE IS UNREPRODUCIBLE. "Incubate 30
 * minutes" leaves the operator to decide whether 34 is acceptable, and two
 * people in the same lab will answer differently. The permitted range is the
 * difference between a protocol and a suggestion.
 *
 * CRITICAL STEPS ARE MARKED, because most steps are forgiving and a few are
 * not, and an operator treating them all alike either goes too slowly
 * everywhere or too quickly at the one point that matters.
 *
 * THE STOPPING POINTS ARE STATED. A protocol nobody can pause is one that gets
 * abandoned mid-run when the day ends, and knowing that step 7 is a safe
 * overnight stop changes how the whole day is planned.
 *
 * HAZARDS SIT ON THE STEP THAT HAS THEM, not in a preamble. Nobody re-reads the
 * safety section at step 12, which is where the phenol is.
 */
export function ProtocolStep({ number, instruction, durationNote, temperatureNote, tolerance, critical, safeStop, hazard, className }: {
  number?: number;
  instruction: string;
  /** Pre-formatted — "30 minutes". */
  durationNote?: string;
  temperatureNote?: string;
  /** The permitted range — "±3 minutes". */
  tolerance?: string;
  /** True where deviation invalidates the run. */
  critical?: boolean;
  /** True where the protocol may be paused here. */
  safeStop?: boolean;
  hazard?: string;
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex gap-3">
        {number !== undefined && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{number}.</span>}
        <span className={cn("min-w-0 flex-1", critical && "font-medium")}>{instruction}</span>
      </p>
      {(durationNote || temperatureNote) && (
        <p className="ps-6 text-xs tabular-nums text-muted-foreground">
          {[durationNote, temperatureNote].filter(Boolean).join(" · ")}
          {tolerance ? ` (${tolerance})` : ""}
        </p>
      )}
      {(durationNote || temperatureNote) && !tolerance && (
        <p className="ps-6 text-xs font-medium">No tolerance stated — two operators will read this differently.</p>
      )}
      {critical && <p className="ps-6 text-xs font-medium">Critical — outside the range, the run is not valid.</p>}
      {safeStop && <p className="ps-6 text-xs text-muted-foreground">Safe to stop here overnight.</p>}
      {hazard && <p className="ps-6 text-xs font-medium">{hazard}</p>}
    </li>
  );
}
