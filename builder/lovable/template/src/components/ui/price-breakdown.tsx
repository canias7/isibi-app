import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * How a total was arrived at, line by line.
 *
 * THE TOTAL IS RECOMPUTED FROM THE LINES rather than taken as a prop, so a
 * breakdown can never disagree with the figure it is explaining. That
 * disagreement is the single fastest way to lose somebody's trust at a
 * checkout, and it happens whenever the two are passed separately.
 *
 * DEDUCTIONS KEEP THEIR SIGN and are not styled apart — a discount is an
 * ordinary line, and colouring it turns a good thing into an alarm.
 *
 * The total is a real `<dt>`/`<dd>` pair in the same list, separated by a rule,
 * because a total in a different element from its lines is announced as
 * unrelated text by a screen reader.
 */
export type PriceLine = { label: string; amount: number; note?: string };

export function PriceBreakdown({ lines, currency = "GBP", totalLabel = "Total", className }: {
  lines: PriceLine[];
  currency?: string;
  totalLabel?: string;
  className?: string;
}) {
  if (!lines.length) return null;
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <dl className={cn("flex flex-col gap-1 text-sm", className)}>
      {lines.map((l, i) => (
        <div key={i} className="flex justify-between gap-4">
          <dt className="min-w-0 text-muted-foreground">
            {l.label}
            {l.note && <span className="block text-xs">{l.note}</span>}
          </dt>
          <dd className="shrink-0 tabular-nums"><Money amount={l.amount} currency={currency} /></dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-medium">
        <dt>{totalLabel}</dt>
        <dd className="tabular-nums"><Money amount={total} currency={currency} /></dd>
      </div>
    </dl>
  );
}
