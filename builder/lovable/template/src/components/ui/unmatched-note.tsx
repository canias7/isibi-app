import { cn } from "@/lib/utils";
/**
 * What is left over after reconciling — with the likely explanation.
 *
 * IT SPLITS "ON THE STATEMENT, NOT IN THE BOOKS" FROM THE REVERSE. They are
 * different problems with different fixes: the first is usually a payment
 * nobody recorded, the second an entry for something that never cleared. A
 * single "unmatched" count is the least useful form this can take.
 *
 * AGE IS THE PRIORITISER. An item unmatched for three days is normal timing; one
 * unmatched for ninety is an error somebody will otherwise carry into the year
 * end, and it is the only ordering that matters here.
 *
 * IT SUGGESTS RATHER THAN DECIDES. Bank charges, an unpresented cheque, a
 * duplicate — naming the likely cause speeds the work, and a component that
 * posted its guess would be creating entries from a heuristic.
 *
 * THE TOTAL DIFFERENCE IS SHOWN, because that is the figure that must reach
 * zero, and watching it fall is how anybody knows the work is going anywhere.
 */
export type UnmatchedItem = {
  id: string;
  description: string;
  amount: number;
  ageDays?: number;
  /** "statement" = seen at the bank, not in the books. */
  side: "statement" | "books";
  likely?: string;
};

export function UnmatchedNote({ items, currency = "GBP", locale = "en-GB", className }: {
  items: UnmatchedItem[];
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const net = items.reduce((n, i) => n + (i.side === "statement" ? i.amount : -i.amount), 0);
  const old = items.filter((i) => (i.ageDays ?? 0) >= 60);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{money(Math.abs(net))} apart</span>
        <span className="text-muted-foreground"> · {items.length} {items.length === 1 ? "item" : "items"} unmatched</span>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {items.map((i) => (
          <li key={i.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1">{i.description}</span>
              <span className="shrink-0 tabular-nums">{money(i.amount)}</span>
            </p>
            <p className={cn("text-xs tabular-nums", (i.ageDays ?? 0) >= 60 ? "font-medium" : "text-muted-foreground")}>
              {i.side === "statement" ? "At the bank, not in the books" : "In the books, not at the bank"}
              {i.ageDays !== undefined && ` · ${i.ageDays} ${i.ageDays === 1 ? "day" : "days"} old`}
            </p>
            {i.likely && <p className="text-xs text-muted-foreground">Probably {i.likely}.</p>}
          </li>
        ))}
      </ul>
      {old.length > 0 && (
        <p className="text-xs">
          {old.length} {old.length === 1 ? "item is" : "items are"} more than two months old — that is an error, not timing.
        </p>
      )}
    </div>
  );
}
