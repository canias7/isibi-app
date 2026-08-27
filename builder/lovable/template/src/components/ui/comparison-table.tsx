import { Check, Minus } from "lucide-react";
import { OverflowScroller } from "@/components/ui/overflow-scroller";
import { cn } from "@/lib/utils";
export type CompareRow = { feature: string; values: (boolean | string)[] };
/** Plans down the side, features down the middle. Booleans render as marks. */
export function ComparisonTable({ columns, rows, className }: {
  columns: string[]; rows: CompareRow[]; className?: string;
}) {
  return (
    <OverflowScroller data-slot="comparison-table" className={className}>
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-3 text-start font-medium">Feature</th>
            {columns.map((c) => <th key={c} className="px-4 py-3 text-center font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature} className="border-b border-border last:border-0">
              <th scope="row" className="py-3 text-start font-normal text-muted-foreground">{r.feature}</th>
              {r.values.map((v, i) => (
                <td key={i} className={cn("px-4 py-3 text-center", typeof v === "string" && "tabular-nums")}>
                  {typeof v === "boolean"
                    ? (v ? <Check className="mx-auto size-4" aria-label="Included" />
                         : <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />)
                    : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </OverflowScroller>
  );
}
