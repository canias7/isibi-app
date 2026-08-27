import { cn } from "@/lib/utils";
/**
 * What a shift produced — against target, and against the time it had.
 *
 * IT IS PACED, NOT TOTALLED. A shift 200 units behind at the halfway point is
 * recoverable and a shift 200 behind at the end is not, and a bare "made 1,340
 * of 1,600" cannot tell them apart. The projection is the thing a supervisor
 * acts on.
 *
 * DOWNTIME IS SHOWN BESIDE THE NUMBER. A shift that missed target with 90
 * minutes of breakdown did not underperform, and a board that shows output
 * alone blames the wrong people — reliably, and to their faces.
 *
 * THE TARGET IS PRORATED to how much of the shift has actually run, so "behind"
 * means behind now rather than behind the full-shift figure, which everybody is
 * at 9am.
 *
 * NO LEAGUE TABLE, DELIBERATELY. Ranking shifts against each other on a shared
 * board turns a measurement into a grievance, and the useful comparison is
 * against the target rather than against the other crew.
 */
export function ShiftOutput({ shift, target, made, elapsedMinutes, shiftMinutes, downtimeMinutes, className }: {
  /** "Early shift", "Nights". */
  shift?: string;
  target: number;
  made: number;
  /** How much of the shift has run. */
  elapsedMinutes?: number;
  shiftMinutes?: number;
  downtimeMinutes?: number;
  className?: string;
}) {
  const through = elapsedMinutes !== undefined && shiftMinutes ? Math.min(1, elapsedMinutes / shiftMinutes) : undefined;
  const expectedNow = through !== undefined ? Math.round(target * through) : undefined;
  const behind = expectedNow !== undefined ? expectedNow - made : target - made;
  const projected = through && through > 0 ? Math.round(made / through) : undefined;
  return (
    <div data-slot="shift-output" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="tabular-nums">
          <span className={cn(behind > 0 && "font-medium")}>{made}</span> of {target}
        </span>
        {shift && <span className="text-muted-foreground"> · {shift}</span>}
      </p>
      {expectedNow !== undefined && (
        <p className={cn("text-xs tabular-nums", behind > 0 ? "font-medium" : "text-muted-foreground")}>
          {behind > 0 ? `${behind} behind where the shift should be by now` : behind < 0 ? `${-behind} ahead of where the shift should be by now` : "Exactly on pace"}
        </p>
      )}
      {projected !== undefined && through !== undefined && through < 1 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          On this pace the shift finishes on about {projected}.
        </p>
      )}
      {downtimeMinutes !== undefined && downtimeMinutes > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {downtimeMinutes} {downtimeMinutes === 1 ? "minute" : "minutes"} of the shift {downtimeMinutes === 1 ? "was" : "were"} lost to stoppages.
        </p>
      )}
    </div>
  );
}
