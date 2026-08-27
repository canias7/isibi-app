import { cn } from "@/lib/utils";
/**
 * One measured characteristic against its tolerance.
 *
 * THE TOLERANCE IS USUALLY ASYMMETRIC AND THE COMPONENT HONOURS THAT. A
 * dimension of 40 +0.2/−0.05 is normal, and a component assuming ±one number
 * passes parts that are out and rejects parts that are in.
 *
 * IN-TOLERANCE-BUT-DRIFTING IS ITS OWN STATE. A reading inside the limit but
 * hard against one edge is the one worth acting on, because the next one is
 * out — and a pass/fail component throws that information away.
 *
 * THE RESULT IS THE MEASUREMENT, not a tick. A recorded number can be
 * re-examined when a customer complains six months later; a stored "pass"
 * cannot, and it is the only thing anybody actually wants from the record.
 *
 * WHO MEASURED IT AND WITH WHAT are part of the line, because a disputed
 * measurement is settled by the gauge's calibration record.
 */
export function QualityCheckRow({ characteristic, nominal, lowerLimit, upperLimit, measured, unit, by, gauge, className }: {
  characteristic: string;
  /** The target value. */
  nominal?: number;
  lowerLimit: number;
  upperLimit: number;
  /** Undefined until somebody measures. */
  measured?: number;
  unit?: string;
  by?: string;
  /** Which gauge — the calibration record hangs off this. */
  gauge?: string;
  className?: string;
}) {
  const has = measured !== undefined;
  const out = has && (measured < lowerLimit || measured > upperLimit);
  const span = upperLimit - lowerLimit;
  const near = has && !out && span > 0 &&
    (measured - lowerLimit < span * 0.1 || upperLimit - measured < span * 0.1);
  const u = unit ? ` ${unit}` : "";
  return (
    <li data-slot="quality-check-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{characteristic}</span>
        <span className={cn("shrink-0 tabular-nums", out && "font-medium")}>
          {has ? `${measured}${u}` : "not measured"}
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {nominal !== undefined && `${nominal}${u} nominal · `}
        {lowerLimit}{u} to {upperLimit}{u}
      </p>
      {out && (
        <p className="text-xs font-medium tabular-nums">
          Outside tolerance by {(measured < lowerLimit ? lowerLimit - measured : measured - upperLimit).toFixed(3).replace(/\.?0+$/, "")}{u}.
        </p>
      )}
      {near && <p className="text-xs font-medium">Inside, but hard against the limit — the next one may be out.</p>}
      {(by || gauge) && (
        <p className="text-xs text-muted-foreground">
          {by && `Measured by ${by}`}
          {by && gauge ? " · " : ""}
          {gauge}
        </p>
      )}
    </li>
  );
}
