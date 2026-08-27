import { cn } from "@/lib/utils";
/**
 * A change of asking price, with the history that buyers can see anyway.
 *
 * THE HISTORY IS SHOWN TO THE SELLER BECAUSE BUYERS ALREADY HAVE IT. Portals
 * keep price histories and buyers read them; hiding the record from the person
 * setting the price means only they are negotiating without it.
 *
 * A SMALL REDUCTION IS FLAGGED AS THE ONE THAT DOES NOT WORK. Dropping by a
 * percent or two changes nothing about which searches the property appears in
 * and reads as a seller testing the water — the useful move is either crossing a
 * round-number search boundary or not moving at all.
 *
 * TIME AT EACH PRICE IS SHOWN, NOT JUST THE PRICES. Three reductions in a month
 * and three over a year say opposite things, and a bare list of numbers cannot
 * tell them apart.
 *
 * THE TOTAL FALL FROM THE FIRST PRICE IS COMPUTED. It is the number a buyer
 * works out immediately and the one a seller watching each small step never does.
 */
export type PricePoint = { id: string; amount: number; from: string; days?: number };

export function AskingPriceChange({ history, proposed, currency = "GBP", locale = "en-GB", className }: {
  /** Oldest first. */
  history: PricePoint[];
  /** A change being considered. */
  proposed?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const first = history[0]?.amount;
  const current = history[history.length - 1]?.amount;
  const fall = first !== undefined && current !== undefined ? first - current : undefined;
  const fallPct = first ? Math.round(((fall ?? 0) / first) * 1000) / 10 : undefined;
  const step = proposed !== undefined && current !== undefined ? current - proposed : undefined;
  const stepPct = current && step !== undefined ? (step / current) * 100 : undefined;
  return (
    <div data-slot="asking-price-change" className={cn("space-y-1.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{current !== undefined ? money(current) : "No price set"}</span>
        {fall !== undefined && fall > 0 && (
          <span className="text-muted-foreground">
            {" "}
            · {money(fall)} below the first price{fallPct !== undefined ? ` (${fallPct}%)` : ""}
          </span>
        )}
      </p>
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {history.map((p) => (
          <li key={p.id} className="flex items-baseline gap-3 px-3 py-1.5 tabular-nums">
            <span className="min-w-0 flex-1">{p.from}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {p.days !== undefined ? `${p.days} ${p.days === 1 ? "day" : "days"}` : ""}
            </span>
            <span className="shrink-0">{money(p.amount)}</span>
          </li>
        ))}
      </ol>
      {step !== undefined && step > 0 && (
        <p className={cn("text-xs tabular-nums", stepPct !== undefined && stepPct < 3 ? "font-medium" : "text-muted-foreground")}>
          Proposed {money(proposed as number)} — down {money(step)}
          {stepPct !== undefined ? ` (${Math.round(stepPct * 10) / 10}%)` : ""}.
          {stepPct !== undefined && stepPct < 3
            ? " Too small to change which searches this appears in. It reads as testing the water."
            : ""}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Buyers can see this history on the listing sites. You are the only person who would be negotiating without it.
      </p>
    </div>
  );
}
