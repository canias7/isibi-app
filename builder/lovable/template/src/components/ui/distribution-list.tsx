import { cn } from "@/lib/utils";
/**
 * Where copies go — with the sale-or-return distinction made obvious.
 *
 * FIRM SALE AND SALE-OR-RETURN ARE COMPLETELY DIFFERENT NUMBERS. Copies on
 * sale-or-return are not sold; they are lent, and a distribution list that adds
 * them into one figure produces a revenue expectation that half of it can
 * reverse.
 *
 * THE ON-SALE DATE IS PER DESTINATION. Copies reach a distant subscriber a week
 * after a city newsagent, and an embargo or a launch built around a single date
 * fails in whichever direction nobody planned for.
 *
 * COPIES UNACCOUNTED FOR ARE SHOWN. Printed minus distributed is rarely zero,
 * and the gap is spoilage, warehouse copies and the ones nobody logged — which
 * is worth seeing rather than reconciling silently.
 *
 * NO SINGLE HEADLINE CIRCULATION FIGURE. Circulation claims are made from
 * whichever of these numbers flatters most, and a component producing one would
 * be picking the flattering one for its caller.
 */
export type Destination = {
  id: string;
  name: string;
  copies: number;
  /** True where unsold copies can be sent back. */
  saleOrReturn?: boolean;
  onSale?: string;
};

export function DistributionList({ destinations, printed, className }: {
  destinations: Destination[];
  /** What was actually printed. */
  printed?: number;
  className?: string;
}) {
  const total = destinations.reduce((n, d) => n + d.copies, 0);
  const firm = destinations.filter((d) => !d.saleOrReturn).reduce((n, d) => n + d.copies, 0);
  const sor = total - firm;
  const unaccounted = printed !== undefined ? printed - total : undefined;
  return (
    <div data-slot="distribution-list" className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{firm.toLocaleString()} sold firm</span>
        {sor > 0 && <span className="text-muted-foreground"> · {sor.toLocaleString()} on sale or return</span>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {destinations.map((d) => (
          <li key={d.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {d.name}
              <span className="block text-xs text-muted-foreground">
                {d.saleOrReturn ? "Sale or return — these can come back" : "Firm sale"}
                {d.onSale && ` · on sale ${d.onSale}`}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{d.copies.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      {unaccounted !== undefined && unaccounted !== 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {Math.abs(unaccounted).toLocaleString()} copies {unaccounted > 0 ? "printed and not distributed" : "distributed beyond the print run"} —
          usually spoilage and warehouse stock, but worth knowing.
        </p>
      )}
      {sor > 0 && (
        <p className="text-xs text-muted-foreground">
          Sale-or-return copies are lent, not sold. Do not count them as revenue yet.
        </p>
      )}
    </div>
  );
}
