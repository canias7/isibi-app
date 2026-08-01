import { cn } from "@/lib/utils";
/**
 * Fuel on board — with the reserves that are not available to burn.
 *
 * USABLE FUEL IS TOTAL MINUS RESERVES, and that is the figure a decision is
 * made on. Reserve fuel is not spare; it is what remains if everything goes
 * wrong, and a display showing only the total invites somebody to plan into it.
 *
 * UPLIFTED AND ON-BOARD ARE DIFFERENT NUMBERS. What was pumped and what the
 * gauges read should agree, and a discrepancy is either a measurement error or a
 * leak — which is worth surfacing rather than reconciling silently.
 *
 * UNITS ARE THE CALLER'S AND ARE ALWAYS SHOWN. Litres, kilograms, gallons and
 * pounds are all in daily use, and fuel-unit confusion has caused actual
 * accidents.
 *
 * IT DOES NOT COMPUTE ENDURANCE. Burn rate depends on load, altitude, sea state
 * and speed, and a component guessing at it would produce a comforting number
 * with nothing behind it.
 */
export function FuelLog({ onBoard, unit = "kg", reserveRequired = 0, uplifted, upliftedBefore, expectedOnBoard, plannedBurn, supplier, className }: {
  onBoard: number;
  unit?: string;
  /** Not available to plan with. */
  reserveRequired?: number;
  /** What was pumped this time. */
  uplifted?: number;
  /** What was on board before the uplift. */
  upliftedBefore?: number;
  /** What the gauges should therefore read. */
  expectedOnBoard?: number;
  /** What the trip is planned to use. */
  plannedBurn?: number;
  supplier?: string;
  className?: string;
}) {
  const usable = onBoard - reserveRequired;
  const discrepancy =
    expectedOnBoard !== undefined ? Number((onBoard - expectedOnBoard).toFixed(2)) : undefined;
  const intoReserve = plannedBurn !== undefined && plannedBurn > usable;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{usable.toLocaleString()} {unit} usable</span>
        <span className="block text-xs text-muted-foreground">
          {onBoard.toLocaleString()} {unit} on board, less {reserveRequired.toLocaleString()} {unit} reserve
        </span>
      </p>
      {plannedBurn !== undefined && (
        <p className={cn("text-xs tabular-nums", intoReserve ? "font-medium" : "text-muted-foreground")}>
          {plannedBurn.toLocaleString()} {unit} planned
          {intoReserve && " — that eats into the reserve, which is not fuel you have"}
        </p>
      )}
      {(uplifted !== undefined || upliftedBefore !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {upliftedBefore !== undefined && `${upliftedBefore.toLocaleString()} ${unit} before`}
          {upliftedBefore !== undefined && uplifted !== undefined ? " · " : ""}
          {uplifted !== undefined && `${uplifted.toLocaleString()} ${unit} uplifted`}
          {supplier && ` · ${supplier}`}
        </p>
      )}
      {discrepancy !== undefined && discrepancy !== 0 && (
        <p className="text-xs font-medium tabular-nums">
          {Math.abs(discrepancy).toLocaleString()} {unit} {discrepancy > 0 ? "more" : "less"} than the uplift accounts for.
          Reconcile it before departure.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Endurance is not calculated here — it depends on load, speed and conditions.
      </p>
    </div>
  );
}
