import { cn } from "@/lib/utils";
/**
 * How long something keeps — under the conditions that were actually tested.
 *
 * A SHELF LIFE IS ONLY VALID UNDER THE STORAGE IT WAS TESTED AT, and the
 * condition is stated with the number every time. "Twelve months" chilled and
 * "twelve months" ambient are different products, and a figure quoted without
 * its condition gets applied to the wrong one — usually by whoever is deciding
 * what to do with a pallet that sat on a loading bay.
 *
 * TIME ALREADY ELAPSED IS SUBTRACTED, so what is shown is what is left rather
 * than what it started with. A shelf life is a property of a batch on a
 * particular day, not a property of the recipe.
 *
 * A BROKEN COLD CHAIN INVALIDATES IT, and the component says so rather than
 * quietly continuing to count down. That is the case where the printed number is
 * actively dangerous.
 *
 * NO EXTRAPOLATION. If the tested life is shorter than the period being asked
 * about, it says the testing does not cover it — which is the honest answer and
 * the one nobody wants to give.
 */
export function ShelfLifeNote({ testedDays, condition, storedAs, daysElapsed, coldChainBroken, brokenNote, className }: {
  testedDays: number;
  /** What it was tested under. Never separated from the number. */
  condition: string;
  /** How it is actually being kept. */
  storedAs?: string;
  daysElapsed?: number;
  /** Invalidates the number outright. */
  coldChainBroken?: boolean;
  brokenNote?: string;
  className?: string;
}) {
  const left = daysElapsed !== undefined ? testedDays - daysElapsed : undefined;
  const mismatch = !!storedAs && storedAs.trim().toLowerCase() !== condition.trim().toLowerCase();
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  if (coldChainBroken) {
    return (
      <div data-slot="shelf-life-note" className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">
          The cold chain was broken, so the tested shelf life no longer applies to this batch.
        </p>
        <p className="text-xs">
          {brokenNote ?? "Nothing here can tell you how long it keeps now. It needs assessing rather than counting down."}
        </p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        {left !== undefined ? (
          <>
            <span className={cn("font-medium", left <= 0 && "")}>
              {left > 0 ? `${days(left)} left` : `${days(Math.abs(left))} past it`}
            </span>
            <span className="text-muted-foreground"> · tested to {days(testedDays)}</span>
          </>
        ) : (
          <span className="font-medium">Keeps {days(testedDays)}</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">Tested {condition}. That number only holds under those conditions.</p>
      {mismatch && (
        <p className="text-xs font-medium">
          This batch is being kept {storedAs}, which is not what it was tested under. The number above does not apply
          to it.
        </p>
      )}
    </div>
  );
}
