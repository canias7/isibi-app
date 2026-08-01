import { cn } from "@/lib/utils";
/**
 * What came out of a batch against what went in.
 *
 * YIELD IS ONLY MEANINGFUL WITH THE INPUT NAMED. 480 litres out is not a
 * number; 480 from 500 is 96% and 480 from 620 is a problem. Losses in a
 * process are normal and the expected figure is what separates the two.
 *
 * IT IS COMPARED TO THE EXPECTED YIELD, not to 100%. Every process loses
 * something — evaporation, trim, offcuts — and judging against perfection makes
 * a good batch look bad and hides the batch that is genuinely off.
 *
 * WHERE THE LOSS WENT IS BROKEN OUT WHERE THE CALLER KNOWS. "20 litres lost" is
 * a shrug; "14 evaporation, 6 in the filter" is a maintenance job.
 *
 * UNITS ARE THE CALLER'S. Yield is measured in litres, kilos, sheets and
 * pieces, and a component assuming one of them is wrong in most industries.
 */
export type YieldLoss = { id: string; label: string; amount: number };

export function BatchYield({ batch, input, output, unit = "kg", expectedPercent, losses = [], className }: {
  batch?: string;
  input: number;
  output: number;
  unit?: string;
  /** What this process normally yields. */
  expectedPercent?: number;
  /** Where the difference went. */
  losses?: YieldLoss[];
  className?: string;
}) {
  const rate = input > 0 ? output / input : 0;
  const pct = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
  const below = expectedPercent !== undefined && rate * 100 < expectedPercent;
  const lost = input - output;
  const explained = losses.reduce((n, l) => n + l.amount, 0);
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className={cn("tabular-nums", below && "font-medium")}>{pct.format(rate)} yield</span>
        {batch && <span className="text-muted-foreground"> · {batch}</span>}
        <span className="block text-xs tabular-nums text-muted-foreground">
          {output} {unit} from {input} {unit}
        </span>
      </p>
      {expectedPercent !== undefined && (
        <p className={cn("text-xs tabular-nums", below ? "font-medium" : "text-muted-foreground")}>
          {below ? "Below" : "At or above"} the {expectedPercent}% normally expected.
        </p>
      )}
      {losses.length > 0 && (
        <ul className="space-y-0.5 pt-0.5 text-xs">
          {losses.map((l) => (
            <li key={l.id} className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 text-muted-foreground">{l.label}</span>
              <span className="shrink-0 tabular-nums">{l.amount} {unit}</span>
            </li>
          ))}
        </ul>
      )}
      {losses.length > 0 && lost - explained > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {(lost - explained).toFixed(2).replace(/\.?0+$/, "")} {unit} unaccounted for.
        </p>
      )}
    </div>
  );
}
