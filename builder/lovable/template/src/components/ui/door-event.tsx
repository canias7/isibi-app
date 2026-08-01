import { cn } from "@/lib/utils";
/**
 * One access attempt at a door — granted, refused, or forced.
 *
 * A REFUSAL AND A FORCED DOOR ARE COMPLETELY DIFFERENT EVENTS and a single
 * "alarm" state loses that. A refused badge is somebody in the wrong place; a
 * door forced or held open is somebody bypassing the system entirely, and it is
 * the only event on this list that needs a person walking towards it.
 *
 * THE REASON FOR A REFUSAL IS SHOWN. Expired card, wrong zone, outside
 * permitted hours and unknown card are four different follow-ups — three are
 * administrative and one is not.
 *
 * AN UNKNOWN CREDENTIAL IS NOT ATTRIBUTED TO A PERSON. Presenting a badge
 * number as a name because it once belonged to somebody is how a leaver's lost
 * card puts them in a building they were never in.
 *
 * NO PHOTOGRAPHS IN THE LOG. A per-event image turns an access list into a
 * surveillance record of everybody's movements, which is a much larger thing
 * than knowing a door opened.
 */
export type DoorOutcome = "granted" | "refused" | "forced" | "held-open" | "unknown-credential";

const WORDS: Record<DoorOutcome, string> = {
  granted: "Opened",
  refused: "Refused",
  forced: "Forced",
  "held-open": "Held open",
  "unknown-credential": "Unknown card",
};

export function DoorEvent({ door, at, outcome, person, badge, reason, className }: {
  door: string;
  /** Free text — "14 July, 08:42". */
  at?: string;
  outcome: DoorOutcome;
  /** Omit where the credential is not attributable. */
  person?: string;
  badge?: string;
  /** Why it was refused. */
  reason?: string;
  className?: string;
}) {
  const urgent = outcome === "forced" || outcome === "held-open";
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {at && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{at}</span>}
        <span className="min-w-0 flex-1">
          {door}
          {person ? (
            <span className="text-muted-foreground"> · {person}</span>
          ) : badge ? (
            <span className="text-muted-foreground"> · card {badge}, not attributed</span>
          ) : null}
        </span>
        <span className={cn("shrink-0 text-xs", urgent ? "font-medium" : "text-muted-foreground")}>
          {WORDS[outcome]}
        </span>
      </p>
      {reason && <p className="text-xs">{reason}</p>}
      {urgent && (
        <p className="text-xs font-medium">
          {outcome === "forced"
            ? "The door was opened without the system — somebody should look now."
            : "The door was held open past its timer — the system did not authorise whoever else went through."}
        </p>
      )}
    </li>
  );
}
