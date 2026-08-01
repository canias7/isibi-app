import { cn } from "@/lib/utils";
/**
 * Waiting for a match — with an honest estimate, or none.
 *
 * THE ESTIMATE IS A RANGE, NOT A NUMBER. Queue times depend on who else is
 * queuing, which nobody can predict, and a precise "2:14" is invented. A range
 * that widens as the wait grows is the truthful shape.
 *
 * IT SAYS WHY A WAIT IS LONG WHERE IT KNOWS. Off-peak hours, a narrow region
 * filter or a restrictive mode are all knowable, and each has an action the
 * player can take. A spinner has none.
 *
 * IT DOES NOT CLAIM TO BE ALMOST DONE. Progress language on an unbounded wait
 * is a lie people notice, and it converts patience into anger the moment it
 * passes.
 *
 * THE ELAPSED TIME IS SHOWN because it is the one number that is actually true,
 * and past a certain point it is the player's cue to change something rather
 * than keep waiting.
 */
export function QueueTimer({ elapsedSeconds, estimateLowSeconds, estimateHighSeconds, longerBecause, canWiden, onWiden, className }: {
  elapsedSeconds: number;
  /** A range, because a single number is invented. */
  estimateLowSeconds?: number;
  estimateHighSeconds?: number;
  /** "you have narrowed to one region". */
  longerBecause?: string;
  /** True where the player could relax a filter. */
  canWiden?: boolean;
  onWiden?: () => void;
  className?: string;
}) {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    return m === 0 ? `${r}s` : r === 0 ? `${m}m` : `${m}m ${r}s`;
  };
  const overEstimate =
    estimateHighSeconds !== undefined && elapsedSeconds > estimateHighSeconds;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{fmt(elapsedSeconds)}</span>
        <span className="text-muted-foreground"> waiting</span>
      </p>
      {estimateLowSeconds !== undefined && estimateHighSeconds !== undefined && (
        <p className={cn("text-xs tabular-nums", overEstimate ? "font-medium" : "text-muted-foreground")}>
          {overEstimate
            ? "Longer than expected. The estimate was wrong, not you."
            : `Usually ${fmt(estimateLowSeconds)} to ${fmt(estimateHighSeconds)} at this time.`}
        </p>
      )}
      {longerBecause && (
        <p className="text-xs">Longer than usual because {longerBecause}.</p>
      )}
      {canWiden && onWiden && (
        <button type="button" onClick={onWiden} className="text-xs underline underline-offset-2">
          Search more widely
        </button>
      )}
    </div>
  );
}
