import { cn } from "@/lib/utils";
/**
 * A round walked — with the checkpoints missed, which is the record.
 *
 * MISSED CHECKPOINTS ARE THE OUTPUT. A completed patrol is unremarkable; the
 * point of logging one is knowing which points were not reached and when, and a
 * report showing only what was scanned is a report that always looks good.
 *
 * THE TIME BETWEEN SCANS IS SHOWN because a patrol completed in four minutes
 * did not happen — the pattern of a walked round is as informative as its
 * completion, and both failure modes are invisible in a tick list.
 *
 * AN OBSERVATION IS SEPARATE FROM A CHECKPOINT. "Fire door propped open on
 * level 2" is the entire value of having somebody walk the building, and a
 * scan-only log has nowhere to put it.
 *
 * IT DOES NOT SCORE THE OFFICER. A patrol log used to rank people produces a
 * log optimised for looking complete, which destroys the one thing it is for.
 */
export type Checkpoint = {
  id: string;
  name: string;
  /** Free text — "02:14". */
  scannedAt?: string;
  /** Minutes since the previous scan. */
  sinceLast?: number;
  observation?: string;
};

export function PatrolLog({ officer, round, checkpoints, startedAt, className }: {
  officer?: string;
  round?: string;
  checkpoints: Checkpoint[];
  startedAt?: string;
  className?: string;
}) {
  const missed = checkpoints.filter((c) => !c.scannedAt);
  const observations = checkpoints.filter((c) => c.observation);
  return (
    <div data-slot="patrol-log" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {round ?? "Patrol"}
        {officer && <span className="text-muted-foreground"> · {officer}</span>}
        {startedAt && <span className="text-muted-foreground"> · started {startedAt}</span>}
      </p>
      {missed.length > 0 && (
        <p className="text-sm font-medium">
          {missed.length} of {checkpoints.length} {missed.length === 1 ? "checkpoint was" : "checkpoints were"} not reached.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {checkpoints.map((c) => (
          <li key={c.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex items-baseline gap-3">
              <span className={cn("min-w-0 flex-1", !c.scannedAt && "font-medium")}>{c.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {c.scannedAt ?? "Not reached"}
              </span>
              {c.sinceLast !== undefined && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  +{c.sinceLast}m
                </span>
              )}
            </p>
            {c.observation && <p className="text-xs">{c.observation}</p>}
          </li>
        ))}
      </ul>
      {observations.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {observations.length} {observations.length === 1 ? "observation" : "observations"} recorded — that is what walking the building is for.
        </p>
      )}
    </div>
  );
}
