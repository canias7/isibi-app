import { cn } from "@/lib/utils";
/**
 * What is driving a bill, sorted by cost rather than by name.
 *
 * SORTED BY WHAT IT COSTS, because the question anybody brings to a usage page
 * is "why is this so much?" — and an alphabetical list of twelve line items
 * makes them add up columns to find out. The biggest thing first answers it in
 * one glance.
 *
 * THE UNIT PRICE IS SHOWN, not just the total. "£240 for storage" is a fact
 * somebody can only act on once they know it is 2,400 GB at 10p — the second
 * form tells them whether to delete files or change plan.
 *
 * INCLUDED ALLOWANCE IS SUBTRACTED VISIBLY. Most plans bundle some usage, and a
 * breakdown that only shows overage makes the total look wrong; showing used,
 * included and charged in that order is what makes the arithmetic checkable.
 *
 * A `<table>` with real headers and `tabular-nums`, since this is a column of
 * money somebody will read down and compare.
 */
export type UsageLine = {
  id: string;
  label: string;
  used: number;
  /** How much the plan covers. */
  included?: number;
  unit?: string;
  /** Pre-formatted price per unit. */
  unitPrice?: string;
  /** Pre-formatted line total. */
  cost: string;
  /** For sorting — the numeric value of `cost`. */
  costValue?: number;
};

export function UsageBreakdown({ lines, total, period, className }: {
  lines: UsageLine[];
  /** Pre-formatted. */
  total?: string;
  /** Free text — "1–31 July". */
  period?: string;
  className?: string;
}) {
  const sorted = [...lines].sort((a, b) => (b.costValue ?? 0) - (a.costValue ?? 0));
  return (
    <div data-slot="usage-breakdown" className={cn("space-y-1.5", className)}>
      {period && <p className="text-xs text-muted-foreground">{period}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="px-2 py-1 text-start font-normal">What</th>
              <th scope="col" className="px-2 py-1 text-end font-normal">Used</th>
              <th scope="col" className="px-2 py-1 text-end font-normal">Charged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((l) => (
              <tr key={l.id}>
                <th scope="row" className="px-2 py-1.5 text-start font-normal">
                  {l.label}
                  {l.unitPrice && <span className="block text-xs text-muted-foreground">{l.unitPrice} each</span>}
                </th>
                <td className="px-2 py-1.5 text-end tabular-nums">
                  {l.used.toLocaleString()}
                  {l.unit && <span className="text-xs text-muted-foreground"> {l.unit}</span>}
                  {l.included !== undefined && (
                    <span className="block text-xs text-muted-foreground">{l.included.toLocaleString()} included</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-end tabular-nums">{l.cost}</td>
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot>
              <tr className="border-t border-border font-medium">
                <th scope="row" className="px-2 py-1.5 text-start">Total</th>
                <td />
                <td className="px-2 py-1.5 text-end tabular-nums">{total}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
