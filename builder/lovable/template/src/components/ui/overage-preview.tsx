import { cn } from "@/lib/utils";
/**
 * What going over an allowance will cost, before the bill arrives.
 *
 * IT COMPARES THE OVERAGE AGAINST THE NEXT PLAN UP. That is the decision — pay
 * £40 in overage this month, or £25 more for a plan that covers it — and a
 * component showing only the overage charge lets somebody pay more than they
 * need to for years without noticing.
 *
 * "AT THIS RATE" IS THE HONEST FRAMING. A projection from a fortnight's usage
 * is an estimate, and a flat "you will be charged £40" that turns into £90 is
 * worse than a hedge. It says the projection is from usage so far.
 *
 * IT ONLY APPEARS ONCE THE ALLOWANCE IS PASSED OR PROJECTED TO BE. A permanent
 * "you may incur charges" is the kind of warning people learn to ignore, and it
 * is the one that must land the month it is true.
 *
 * MONEY IS PRE-FORMATTED, so currency belongs to the caller's own `money`
 * helper — the rule the rest of this kit follows.
 */
export function OveragePreview({ used, included, unit = "units", projected, cost, upgradeName, upgradeCost, upgradeSaves, className }: {
  used: number;
  included: number;
  unit?: string;
  /** Projected usage by the end of the period. */
  projected?: number;
  /** Pre-formatted projected overage charge. */
  cost?: string;
  /** The plan that would cover it. */
  upgradeName?: string;
  /** Pre-formatted extra cost of that plan. */
  upgradeCost?: string;
  /** True when upgrading is cheaper than the overage. */
  upgradeSaves?: boolean;
  className?: string;
}) {
  const over = used > included;
  const willGoOver = projected !== undefined && projected > included;
  if (!over && !willGoOver) return null;
  const excess = Math.max(0, (projected ?? used) - included);
  return (
    <div data-slot="overage-preview" className={cn("space-y-1 rounded-md border border-border p-3 text-sm", className)}>
      <p>
        <span className="font-medium">
          {over ? "You are over your allowance" : "You are on course to go over"}
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {used.toLocaleString()} of {included.toLocaleString()} {unit} used
          {projected !== undefined && ` · about ${projected.toLocaleString()} by the end of the period`}
        </span>
      </p>
      {cost && (
        <p className="text-sm">
          At this rate that is <span className="font-medium">{cost}</span> extra
          <span className="text-muted-foreground tabular-nums"> · {excess.toLocaleString()} {unit} over</span>
        </p>
      )}
      {upgradeName && (
        <p className="text-xs text-muted-foreground">
          {upgradeName} would cover it{upgradeCost ? ` for ${upgradeCost} more` : ""}
          {upgradeSaves && <span className="font-medium text-foreground"> — cheaper than the overage.</span>}
        </p>
      )}
    </div>
  );
}
