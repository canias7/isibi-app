import { cn } from "@/lib/utils";
/**
 * What a field produced, per unit area, adjusted to a standard moisture.
 *
 * TONNES ALONE ARE NOT COMPARABLE. A bigger field produces more of everything,
 * so the number that means anything is per hectare or per acre — and grain
 * weighed at 18% moisture against 15% is 3% water being sold as crop. Both
 * corrections are what turn a weighbridge ticket into a comparison.
 *
 * IT COMPARES AGAINST THE FARM'S OWN HISTORY, not a national average. Soil type
 * dominates everything else, so a field yielding below the regional figure may
 * be doing very well for what it is — and its own five-year mean is the only
 * fair benchmark.
 *
 * THE UNIT IS NAMED, always. Tonnes per hectare and tonnes per acre differ by
 * 2.47, and both are used in the same conversations.
 *
 * NO PRICE. Yield and price are separate decisions made at separate times, and
 * a component that multiplies them implies a sale that has not happened.
 */
export function YieldNote({ crop, yieldValue, unit = "t/ha", moisture, standardMoisture, farmAverage, className }: {
  crop?: string;
  /** Per unit area. */
  yieldValue: number;
  unit?: string;
  /** As weighed, percent. */
  moisture?: number;
  /** What it is adjusted to. */
  standardMoisture?: number;
  /** The farm's own mean for this crop. */
  farmAverage?: number;
  className?: string;
}) {
  const diff = farmAverage !== undefined ? yieldValue - farmAverage : null;
  const pct = farmAverage ? Math.round((diff! / farmAverage) * 100) : null;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {crop && <span className="text-muted-foreground">{crop} · </span>}
        <span className="font-medium tabular-nums">{yieldValue.toFixed(2)}</span>
        <span className="text-muted-foreground"> {unit}</span>
      </p>
      {moisture !== undefined && (
        <p className="text-xs text-muted-foreground">
          Weighed at <span className="tabular-nums">{moisture}%</span>
          {standardMoisture !== undefined && (
            <span className="tabular-nums"> · adjusted to {standardMoisture}%</span>
          )}
        </p>
      )}
      {diff !== null && pct !== null && (
        <p className="text-xs text-muted-foreground">
          <span aria-hidden="true">{diff >= 0 ? "↑" : "↓"} </span>
          <span className="tabular-nums text-foreground">{Math.abs(pct)}%</span>{" "}
          {diff >= 0 ? "above" : "below"} this farm's own average of{" "}
          <span className="tabular-nums">{farmAverage!.toFixed(2)}</span>
        </p>
      )}
    </div>
  );
}
