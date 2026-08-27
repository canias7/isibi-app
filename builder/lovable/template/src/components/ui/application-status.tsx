import { cn } from "@/lib/utils";
/**
 * Where an application has got to — and whose move it is.
 *
 * "WAITING ON YOU" AND "WAITING ON US" ARE THE ONLY TWO STATES THAT MATTER, and
 * they are stated in those words. Every progress tracker of this kind buries
 * the one actionable fact under stage names the applicant did not choose and
 * cannot interpret, and people wait months for an office that is waiting for
 * them.
 *
 * THE WAIT IS GIVEN AS A TYPICAL TIME, not a promise or a percentage. "Most
 * decisions take 6 to 8 weeks" is checkable and survivable; a progress bar at
 * 60% is invented and is read as a commitment.
 *
 * HOW LONG IT HAS ALREADY BEEN is shown beside that. Somebody at week ten of a
 * six-to-eight-week process has a legitimate complaint and should be able to see
 * it without doing arithmetic.
 *
 * STAGES ARE NOT NUMBERED OUT OF A TOTAL, because applications skip and repeat
 * stages, and "step 3 of 5" then goes backwards, which reads as something having
 * gone wrong.
 */
export function ApplicationStatus({ stage, waitingOn, since, typicalWait, needed, decisionBy, className }: {
  /** Plain words — "Being assessed". */
  stage: string;
  waitingOn: "you" | "us" | "someone-else";
  /** Free text — "3 weeks". */
  since?: string;
  /** Free text — "6 to 8 weeks". */
  typicalWait?: string;
  /** What the applicant has to do, when it is their move. */
  needed?: string;
  /** Free text, where a date is actually committed. */
  decisionBy?: string;
  className?: string;
}) {
  return (
    <div data-slot="application-status" className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">
        {waitingOn === "you"
          ? "We are waiting for you"
          : waitingOn === "us"
            ? "We are working on it"
            : "Waiting on someone else"}
      </p>
      <p className="text-xs text-muted-foreground">
        {stage}
        {since && ` · ${since} so far`}
      </p>
      {waitingOn === "you" && needed && <p className="text-xs font-medium">{needed}</p>}
      {typicalWait && (
        <p className="text-xs text-muted-foreground">Most take {typicalWait}.</p>
      )}
      {decisionBy && <p className="text-xs">A decision is due by {decisionBy}.</p>}
    </div>
  );
}
