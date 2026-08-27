import { cn } from "@/lib/utils";
/**
 * When an instrument was last calibrated — and what an overdue one invalidates.
 *
 * THE CONSEQUENCE IS NAMED, NOT JUST THE DATE. An instrument out of calibration
 * does not merely need booking in: every result it produced since the drift
 * began is in question, and the number of runs affected is what turns a diary
 * entry into an action.
 *
 * DUE AND OVERDUE ARE DIFFERENT AND SO ARE THEIR AUDIENCES. Due is a manager's
 * scheduling problem; overdue is an analyst's decision about whether to run at
 * all, taken at the bench.
 *
 * THE STANDARD USED IS RECORDED, because a calibration is only as good as what
 * it was calibrated against, and a certificate that has itself expired is the
 * quiet version of this failure.
 *
 * VERIFICATION IS SEPARATE FROM CALIBRATION. A daily check confirms the
 * instrument has not moved; a calibration sets it. Merging them lets a year of
 * daily checks stand in for an adjustment that never happened.
 */
export function CalibrationNote({ instrument, lastOn, dueOn, daysOverdue = 0, standard, standardExpires, lastVerifiedOn, runsSinceDue, className }: {
  instrument?: string;
  /** Free text — "14 January". */
  lastOn?: string;
  dueOn?: string;
  daysOverdue?: number;
  /** What it was calibrated against. */
  standard?: string;
  /** When that standard's own certificate lapses. */
  standardExpires?: string;
  /** The daily check, which is not a calibration. */
  lastVerifiedOn?: string;
  /** How many runs have happened since it fell due. */
  runsSinceDue?: number;
  className?: string;
}) {
  const over = daysOverdue > 0;
  return (
    <div data-slot="calibration-note" className={cn("space-y-0.5 text-sm", className)}>
      {/* The instrument is on its own line: names routinely contain a dash
          ("Pipette P200 — 04471"), and joining with another produces a sentence
          with two of them. */}
      {instrument && <p className="text-xs text-muted-foreground">{instrument}</p>}
      <p className={cn(over && "font-medium")}>
        {over
          ? `Calibration ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue`
          : dueOn ? `Calibration due ${dueOn}` : "Calibration date not recorded"}
      </p>
      {lastOn && <p className="text-xs text-muted-foreground">Last calibrated {lastOn}.</p>}
      {over && runsSinceDue !== undefined && runsSinceDue > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {runsSinceDue} {runsSinceDue === 1 ? "run has" : "runs have"} been done since it fell due — those results are in question.
        </p>
      )}
      {standard && (
        <p className="text-xs text-muted-foreground">
          Against {standard}
          {standardExpires && ` · that standard's certificate runs to ${standardExpires}`}
        </p>
      )}
      {lastVerifiedOn && (
        <p className="text-xs text-muted-foreground">
          Verified {lastVerifiedOn} — a check that it has not moved, which is not the same as calibrating it.
        </p>
      )}
    </div>
  );
}
