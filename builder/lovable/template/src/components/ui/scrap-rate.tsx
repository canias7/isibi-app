import { cn } from "@/lib/utils";
/**
 * How much is being thrown away, and what it costs.
 *
 * IT IS SHOWN AS A RATE AND AS MONEY. A percentage is comparable across
 * products and persuades nobody; the cost persuades and cannot be compared. A
 * scrap figure without both gets either ignored or misprioritised.
 *
 * FIRST-PASS YIELD IS THE HONEST NUMBER AND IS SHOWN BESIDE IT. Parts that were
 * reworked into good ones are not scrap and are not free — counting only final
 * scrap hides an entire rework operation that somebody is paying for.
 *
 * IT IS SHOWN AGAINST A TARGET WHERE THERE IS ONE, because 3% means nothing on
 * its own: excellent for one process and a crisis in another, and the person
 * reading it usually knows which but the component should not assume.
 *
 * THE TREND IS ONE WORD, not a sparkline. "Worse than last month" is the whole
 * message, and a chart at this size is decoration.
 */
export function ScrapRate({ made, scrapped, reworked = 0, unitCost, targetPercent, trend, currency = "GBP", locale = "en-GB", className }: {
  /** Total produced, good and bad. */
  made: number;
  scrapped: number;
  /** Made bad, then fixed. */
  reworked?: number;
  /** Cost of one scrapped unit. */
  unitCost?: number;
  targetPercent?: number;
  trend?: "better" | "worse" | "flat";
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const rate = made > 0 ? scrapped / made : 0;
  const firstPass = made > 0 ? (made - scrapped - reworked) / made : 0;
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const money = unitCost !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(scrapped * unitCost)
    : undefined;
  const overTarget = targetPercent !== undefined && rate * 100 > targetPercent;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className={cn("tabular-nums", overTarget && "font-medium")}>{pct.format(rate)} scrapped</span>
        {money && <span className="text-muted-foreground tabular-nums"> · {money}</span>}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {scrapped} of {made} made
        {reworked > 0 && ` · ${reworked} reworked`}
        {` · ${pct.format(firstPass)} right first time`}
      </p>
      {targetPercent !== undefined && (
        <p className={cn("text-xs tabular-nums", overTarget ? "font-medium" : "text-muted-foreground")}>
          {overTarget ? "Above" : "Within"} the {targetPercent}% target.
        </p>
      )}
      {trend && (
        <p className="text-xs text-muted-foreground">
          {trend === "better" ? "Better than last period." : trend === "worse" ? "Worse than last period." : "About the same as last period."}
        </p>
      )}
    </div>
  );
}
