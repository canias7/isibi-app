import { cn } from "@/lib/utils";
/**
 * A long-running migration, with the failures visible while it runs.
 *
 * FAILURES ARE COUNTED DURING, NOT AFTER. A migration that reports errors only
 * at the end runs for four hours before anybody learns the first thousand rows
 * all failed for the same reason — which is four hours that could have been
 * spent fixing it and re-running.
 *
 * IT ESTIMATES THE REMAINING TIME FROM THE OBSERVED RATE, and says the rate.
 * "45 minutes left" from a rate that has been falling is wrong in the
 * comforting direction, and showing the rate lets somebody notice.
 *
 * IT SAYS WHETHER STOPPING IS SAFE. A migration that can be resumed and one
 * that leaves the data half-converted are entirely different, and this is the
 * screen somebody is looking at when they need to leave.
 *
 * `<progress>` plus text, since a bar that has stopped moving is
 * indistinguishable from a slow one — the same reasoning as
 * `rollout-progress`.
 */
export function MigrationProgress({ done, total, failed = 0, perSecond, remaining, state, resumable, className }: {
  done: number;
  total: number;
  failed?: number;
  /** Observed rate. */
  perSecond?: number;
  /** Free text — "about 45 minutes". */
  remaining?: string;
  state: "running" | "paused" | "done" | "failed";
  /** True when stopping leaves it resumable. */
  resumable?: boolean;
  className?: string;
}) {
  const WORD = { running: "Running", paused: "Paused", done: "Finished", failed: "Stopped with errors" } as const;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className={cn(state !== "running" && "font-medium")}>{WORD[state]}</span>
        <span className="tabular-nums text-muted-foreground">
          {done.toLocaleString()} of {total.toLocaleString()}
        </span>
        {failed > 0 && (
          <span className="font-medium tabular-nums">{failed.toLocaleString()} failed</span>
        )}
      </p>
      <progress value={done} max={Math.max(total, 1)} aria-label="Migration progress"
        className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground" />
      <p className="text-xs text-muted-foreground">
        {state === "running" && (
          <>
            {remaining && <span>{remaining} left. </span>}
            {perSecond !== undefined && <span className="tabular-nums">{perSecond.toLocaleString()} a second. </span>}
          </>
        )}
        {state !== "done" && (
          resumable
            ? "You can stop this and carry on later from where it got to."
            : "Stopping this leaves the data half-converted — let it finish."
        )}
      </p>
    </div>
  );
}
