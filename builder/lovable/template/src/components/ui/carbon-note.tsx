import { cn } from "@/lib/utils";
/**
 * The emissions behind a figure — with the basis stated.
 *
 * THE FACTOR AND ITS SOURCE ARE SHOWN, and this is the whole credibility of the
 * number. The same kilowatt-hour is 0.02 or 0.4 kg of CO₂ depending on the grid
 * and the year, and an unsourced total is a claim rather than a measurement.
 *
 * IT REFUSES THE FAMILIAR COMPARISONS. "Equivalent to planting 40 trees" is
 * unfalsifiable, varies by an order of magnitude with species and decade, and
 * makes an offset sound like a removal. The number and its unit are the honest
 * output.
 *
 * WHAT IS EXCLUDED IS NAMED. Nearly every figure of this kind covers energy
 * only and omits everything upstream — a total presented without that reads as
 * complete and is a fraction of the real one.
 *
 * A MARKET-BASED FIGURE IS LABELLED AS SUCH. Buying certificates changes the
 * reported number and not the emissions, and the two bases regularly differ by
 * more than any action taken that year.
 */
export function CarbonNote({ kgCo2e, activity, factor, factorUnit = "kWh", factorSource, basis = "location", excludes = [], className }: {
  kgCo2e: number;
  /** What produced it — "your electricity, July". */
  activity?: string;
  /** kg CO₂e per unit. */
  factor?: number;
  factorUnit?: string;
  /** Where the factor came from, and its year. */
  factorSource?: string;
  /** Market-based figures reflect purchased certificates, not physical emissions. */
  basis?: "location" | "market";
  /** What the figure does not cover. */
  excludes?: string[];
  className?: string;
}) {
  const value = kgCo2e >= 1000
    ? `${(kgCo2e / 1000).toFixed(2).replace(/\.?0+$/, "")} tonnes`
    : `${kgCo2e.toFixed(1).replace(/\.0$/, "")} kg`;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="tabular-nums">{value} CO₂e</span>
        {activity && <span className="text-muted-foreground"> · {activity}</span>}
      </p>
      {factor !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          At {factor} kg per {factorUnit}
          {factorSource && ` · ${factorSource}`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {basis === "market"
          ? "Market-based — this reflects the certificates bought, not the electricity physically delivered."
          : "Location-based — this reflects the grid the supply actually came from."}
      </p>
      {excludes.length > 0 && (
        <p className="text-xs">Does not include {excludes.join(", ")}.</p>
      )}
    </div>
  );
}
