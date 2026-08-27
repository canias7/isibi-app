import { PriceList, type PriceRow } from "@/components/ui/price-list";
import { cn } from "@/lib/utils";

export type MenuGroup = { name: string; note?: string | null; items: PriceRow[] };

/**
 * A menu in categories — Starters, Mains, Drinks.
 *
 * Built on PriceList rather than repeating its row markup, so a change to how a
 * price renders happens once.
 */
export function MenuSection({ groups, currency = "£", className }: {
  groups: MenuGroup[];
  currency?: string;
  className?: string;
}) {
  return (
    <div data-slot="menu-section" className={cn("flex flex-col gap-10", className)}>
      {groups.map((g, i) => (
        <section key={g.name || i}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-medium tracking-tight">{g.name}</h3>
            {g.note && <span className="text-xs text-muted-foreground">{g.note}</span>}
          </div>
          <PriceList items={g.items} currency={currency} />
        </section>
      ))}
    </div>
  );
}
