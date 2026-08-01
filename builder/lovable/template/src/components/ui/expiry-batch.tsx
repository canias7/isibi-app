import { cn } from "@/lib/utils";
/**
 * Stock grouped by how soon it goes off, so the urgent part is visible.
 *
 * A SINGLE STOCK NUMBER HIDES THE ONLY THING THAT MATTERS about perishables.
 * "40 in stock" is fine; "40 in stock, 18 of them out of date on Friday" is a
 * decision — discount them, move them to the front, or write them off. The
 * total is the least useful figure on this component.
 *
 * ALREADY-EXPIRED STOCK IS COUNTED SEPARATELY AND FIRST, because it is not
 * stock at all — counting it in a total is how a shop believes it has enough
 * and finds out at the counter.
 *
 * THE BUCKETS ARE THE CALLER'S. Days matter for bread and months for tinned
 * goods, and a fixed set of windows is wrong for one of them.
 *
 * WORDS AND WEIGHT, no traffic lights. This is a stock report that gets
 * printed, and a red row prints grey.
 */
export type ExpiryBucket = { label: string; quantity: number; expired?: boolean };

export function ExpiryBatch({ buckets, unit = "units", className }: {
  /** Soonest first. */
  buckets: ExpiryBucket[];
  unit?: string;
  className?: string;
}) {
  if (!buckets.length) return null;
  const expired = buckets.filter((b) => b.expired).reduce((n, b) => n + b.quantity, 0);
  const good = buckets.filter((b) => !b.expired).reduce((n, b) => n + b.quantity, 0);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{good.toLocaleString()}</span>
        <span className="text-muted-foreground"> {unit} usable</span>
        {expired > 0 && (
          <span className="block text-xs">
            <span className="font-medium tabular-nums">{expired.toLocaleString()}</span> already out of date
          </span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {buckets.map((b) => (
          <li key={b.label} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className={cn(b.expired ? "font-medium" : "text-muted-foreground")}>{b.label}</span>
            <span className={cn("tabular-nums", b.expired && "font-medium")}>{b.quantity.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
