import { cn } from "@/lib/utils";
/**
 * A batch being made — with yield measured against what went in.
 *
 * YIELD IS COMPUTED FROM INPUT AND OUTPUT, NEVER SUPPLIED. It is the number that
 * tells a producer whether something is wrong, and a typed-in percentage is the
 * number that tells them what somebody hoped. Loss shows up here before it shows
 * up in the accounts.
 *
 * REWORK AND WASTE ARE SEPARATE FROM GOOD OUTPUT AND FROM EACH OTHER. Product
 * that goes back through the process costs time and product that is thrown away
 * costs everything, and a single "not good" figure hides which problem this is.
 *
 * THE RUN IS TIED TO ITS INPUT BATCHES. A recall works backwards from the
 * finished thing to the sack of flour, and a run that does not record what went
 * into it makes that impossible — which turns a targeted recall into a total one.
 *
 * NO EFFICIENCY SCORE. Yield, waste and rework are three facts; combining them
 * into one number destroys exactly the information somebody needs to act.
 */
export function ProductionRun({ product, batchCode, inputQuantity, goodOutput, rework = 0, waste = 0, unit = "kg", inputBatches = [], startedAt, finishedAt, className }: {
  product: string;
  batchCode?: string;
  inputQuantity: number;
  goodOutput: number;
  /** Goes back through. Costs time. */
  rework?: number;
  /** Thrown away. Costs everything. */
  waste?: number;
  unit?: string;
  /** What a recall works backwards to. */
  inputBatches?: string[];
  startedAt?: string;
  finishedAt?: string;
  className?: string;
}) {
  // Computed. A supplied yield is the number somebody hoped for.
  const yieldPct = inputQuantity > 0 ? (goodOutput / inputQuantity) * 100 : 0;
  const unaccounted = inputQuantity - goodOutput - rework - waste;
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const q = (v: number) => `${Number(v.toFixed(2))} ${unit}`;
  return (
    <div data-slot="production-run" className={cn("space-y-1 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{product}</span>
        {batchCode && <span className="shrink-0 tabular-nums text-muted-foreground">{batchCode}</span>}
      </p>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{Math.round(yieldPct * 10) / 10}% yield</span>
        <span className="text-muted-foreground">
          {" "}
          · {q(goodOutput)} good from {q(inputQuantity)}
        </span>
      </p>
      <dl className="space-y-0.5 text-xs tabular-nums text-muted-foreground">
        <div className="flex justify-between gap-4">
          <dt>Rework — goes back through</dt>
          <dd>{q(rework)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Waste — thrown away</dt>
          <dd>{q(waste)}</dd>
        </div>
      </dl>
      {Math.abs(unaccounted) > 0.005 && (
        <p className="text-xs font-medium tabular-nums">
          {q(Math.abs(unaccounted))} {unaccounted > 0 ? "unaccounted for" : "more out than went in"}. The numbers do
          not close.
        </p>
      )}
      {inputBatches.length > 0 ? (
        <p className="text-xs text-muted-foreground">Made from {AND.format(inputBatches)}.</p>
      ) : (
        <p className="text-xs font-medium">
          No input batches recorded. A recall would have to take everything, not just this.
        </p>
      )}
      {(startedAt || finishedAt) && (
        <p className="text-xs text-muted-foreground">{[startedAt, finishedAt].filter(Boolean).join(" to ")}</p>
      )}
    </div>
  );
}
