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
  items, currency = "£", action, className,
}: {
  items: PriceRow[];
  currency?: string;
  /** Optional per-row button, e.g. "Book". */
  action?: { label: string; onSelect: (row: PriceRow) => void };
  className?: string;
}) {
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
              {typeof r.price === "number" ? currency + r.price : r.price}
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
