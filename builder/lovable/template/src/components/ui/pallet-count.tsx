import { cn } from "@/lib/utils";
/**
 * Pallets on a load — counted by type, because they are not interchangeable.
 *
 * PALLET TYPES HAVE DIFFERENT FOOTPRINTS and a trailer holds different numbers
 * of each. Counting "26 pallets" without saying which is how a load is booked
 * onto a vehicle it does not fit — the standard European and UK sizes differ by
 * enough to change the count by several.
 *
 * DOUBLE-STACKING IS A SEPARATE FACT. A load that can be stacked occupies half
 * the floor; one that cannot occupies all of it, and the difference is usually
 * a property of the goods rather than the pallet. It changes the vehicle
 * booked.
 *
 * PALLET EXCHANGE IS TRACKED, because returnable pallets are an asset and an
 * unbalanced account is a real cost that appears months later as an invoice
 * nobody expects.
 *
 * NO CONVERSION BETWEEN TYPES. The number of one that equals another depends on
 * how they are loaded, and a component doing that arithmetic would be wrong for
 * most vehicles.
 */
export type PalletLine = { type: string; count: number; stackable?: boolean; footprint?: string };

export function PalletCount({ lines, exchangeOwed, exchangeDue, className }: {
  lines: PalletLine[];
  /** Pallets we owe the carrier. */
  exchangeOwed?: number;
  /** Pallets they owe us. */
  exchangeDue?: number;
  className?: string;
}) {
  const total = lines.reduce((n, l) => n + l.count, 0);
  const floor = lines.reduce((n, l) => n + (l.stackable ? Math.ceil(l.count / 2) : l.count), 0);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{total}</span> pallets
        {floor !== total && (
          <span className="text-muted-foreground tabular-nums"> · {floor} floor spaces if double-stacked</span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {lines.map((l) => (
          <li key={l.type} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span>
              {l.type}
              {l.footprint && <span className="text-xs text-muted-foreground"> · {l.footprint}</span>}
              <span className="block text-xs text-muted-foreground">
                {l.stackable ? "Can be double-stacked" : "Cannot be stacked"}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{l.count}</span>
          </li>
        ))}
      </ul>
      {(exchangeOwed !== undefined || exchangeDue !== undefined) && (
        <p className="text-xs text-muted-foreground">
          Pallet exchange:
          {exchangeOwed ? <span className="tabular-nums"> we owe {exchangeOwed}</span> : null}
          {exchangeOwed && exchangeDue ? " ·" : ""}
          {exchangeDue ? <span className="tabular-nums"> they owe us {exchangeDue}</span> : null}
          {!exchangeOwed && !exchangeDue ? " balanced" : ""}
        </p>
      )}
    </div>
  );
}
