import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PriceRow = {
  name: string;
  description?: string | null;
  price?: number | string | null;
  meta?: string | null;
};

/**
 * Name, description, price — a menu or a service list.
 *
 * The single most common shape on a site this platform builds: every barber
 * shop, cafe and studio has one, and it maps straight onto a `display` table.
 */
export function PriceList({
  items, currency = "£", locale = "en-GB", action, className,
}: {
  items: PriceRow[];
  /** The SYMBOL, not an ISO code — this is a prefix, not `Intl` currency style. */
  currency?: string;
  /** Grouping and decimal marks. Not the symbol, which is `currency`. */
  locale?: string;
  /** Optional per-row button, e.g. "Book". */
  action?: { label: string; onSelect: (row: PriceRow) => void };
  className?: string;
}) {
  // A NUMBER PRICE WAS BEING CONCATENATED STRAIGHT ONTO THE SYMBOL, so 3.2 came
  // out as "£3.2" and 4200 as "£4200". Both were wrong on every site this kit
  // has ever built, on the most-used component in it — found by looking at a
  // farm shop's egg price, not by any test, because a wrong money format
  // compiles perfectly.
  //
  // Whole numbers keep no decimals: a menu wants "£12", not "£12.00". Anything
  // fractional gets exactly two, because "£3.2" is not a price anybody writes.
  const fmt = (n: number) =>
    currency + n.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((r, i) => (
        <li key={r.name || i} className="flex items-baseline gap-4 border-b border-border py-4 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{r.name}</span>
              {r.meta && <span className="text-xs text-muted-foreground">{r.meta}</span>}
            </div>
            {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}
          </div>
          {r.price != null && r.price !== "" && (
            <span className="shrink-0 tabular-nums font-medium">
              {typeof r.price === "number" ? fmt(r.price) : r.price}
            </span>
          )}
          {action && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => action.onSelect(r)}>
              {action.label}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
