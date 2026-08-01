import { cn } from "@/lib/utils";
/**
 * Where usage is heading, and when the allowance runs out.
 *
 * "YOU WILL RUN OUT ON THE 22ND" IS THE ONLY USEFUL OUTPUT. A projected total
 * still needs comparing against the allowance and dividing by the days left; a
 * date is something somebody can act on, and it is the sentence every usage
 * dashboard leaves the reader to derive.
 *
 * IT SAYS WHAT THE PROJECTION IS FROM. Extrapolating from three days of a
 * thirty-day month is nearly meaningless, and the reader can only judge that if
 * told how much data it rests on — the same discipline as `response-rate`.
 *
 * A FLAT OR FALLING TREND IS REPORTED TOO. Usage forecasts only ever warn, so a
 * month that is comfortably inside the allowance produces silence — and silence
 * is indistinguishable from a broken forecast.
 *
 * NO CHART. A sparkline of daily usage is decoration next to the date; the
 * caller can add one, and the sentence is what gets read.
 */
export function UsageForecast({ used, included, projected, runOutOn, daysObserved, daysInPeriod, unit = "units", className }: {
  used: number;
  included: number;
  /** Projected total by the end of the period. */
  projected?: number;
  /** Free text — "the 22nd", or absent if it will not. */
  runOutOn?: string;
  daysObserved?: number;
  daysInPeriod?: number;
  unit?: string;
  className?: string;
}) {
  const willExceed = projected !== undefined && projected > included;
  const thin = daysObserved !== undefined && daysInPeriod !== undefined && daysObserved < daysInPeriod / 4;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {runOutOn ? (
          <>
            <span className="font-medium">You will run out around {runOutOn}</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {used.toLocaleString()} of {included.toLocaleString()} {unit} used
            </span>
          </>
        ) : willExceed ? (
          <>
            <span className="font-medium">On course to go over</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              about {projected!.toLocaleString()} against {included.toLocaleString()} {unit}
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">On course to stay inside your allowance</span>
            {projected !== undefined && (
              <span className="block text-xs text-muted-foreground tabular-nums">
                about {projected.toLocaleString()} of {included.toLocaleString()} {unit}
              </span>
            )}
          </>
        )}
      </p>
      {daysObserved !== undefined && (
        <p className="text-xs text-muted-foreground">
          From {daysObserved} {daysObserved === 1 ? "day" : "days"}
          {daysInPeriod !== undefined && ` of ${daysInPeriod}`}
          {thin && " — too little to be sure yet"}.
        </p>
      )}
    </div>
  );
}
