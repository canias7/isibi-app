import { cn } from "@/lib/utils";
/**
 * How much water has gone on, against what is licensed and what is needed.
 *
 * THE ABSTRACTION LICENCE IS A HARD CEILING and exceeding it is an offence.
 * Most systems track what was applied; almost none track it against the annual
 * volume permitted, so the limit is discovered in the last weeks of a dry
 * season when there is nothing to be done.
 *
 * SOIL MOISTURE DEFICIT IS THE NUMBER THAT DECIDES, not the calendar or the
 * total applied. Irrigating a soil already at field capacity runs water past
 * the root zone, taking nutrients with it — cost twice.
 *
 * IT WARNS ON THE PERCENTAGE OF THE LICENCE, not on the absolute figure. A
 * licence is a different size on every holding, and the fraction used is what
 * transfers.
 *
 * NO SCHEDULING ADVICE. When to irrigate depends on crop stage, forecast, soil
 * type and what the sprayer is doing — and a component saying "irrigate now"
 * would be wrong often enough to be ignored entirely.
 */
export function IrrigationNote({ appliedThisYear, licensed, unit = "m³", deficit, deficitUnit = "mm", lastApplied, warnAt = 0.8, className }: {
  appliedThisYear: number;
  /** The annual abstraction limit. */
  licensed?: number;
  unit?: string;
  /** Soil moisture deficit. */
  deficit?: number;
  deficitUnit?: string;
  /** Free text — "4 days ago, 18mm". */
  lastApplied?: string;
  warnAt?: number;
  className?: string;
}) {
  const share = licensed ? appliedThisYear / licensed : 0;
  const over = licensed !== undefined && appliedThisYear > licensed;
  const near = !over && share >= warnAt;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="tabular-nums">{appliedThisYear.toLocaleString()}</span>
        <span className="text-muted-foreground"> {unit} this year</span>
        {licensed !== undefined && (
          <span className="text-muted-foreground tabular-nums"> of {licensed.toLocaleString()} licensed</span>
        )}
      </p>
      {(over || near) && (
        <p className="text-xs font-medium">
          {over
            ? `Over the licence by ${(appliedThisYear - licensed!).toLocaleString()} ${unit} — this is an offence.`
            : `${Math.round(share * 100)}% of the licence used.`}
        </p>
      )}
      {deficit !== undefined && (
        <p className="text-xs text-muted-foreground">
          Soil moisture deficit <span className="tabular-nums text-foreground">{deficit} {deficitUnit}</span>
          {deficit <= 0 && <span className="font-medium text-foreground"> — the soil is full, more water runs past the roots.</span>}
        </p>
      )}
      {lastApplied && <p className="text-xs text-muted-foreground">Last applied {lastApplied}.</p>}
    </div>
  );
}
