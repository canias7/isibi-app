import { cn } from "@/lib/utils";
/**
 * An offer on a property — the amount is the least of it.
 *
 * THE CONDITIONS ARE PART OF THE OFFER AND ARE SHOWN BESIDE THE NUMBER. An offer
 * subject to a survey, a sale, a mortgage and a six-month completion is a
 * different proposition from the same figure in cash, and a list sorted purely
 * by amount recommends the wrong one every time.
 *
 * IT DOES NOT RANK. Which offer is best depends on what the seller needs — speed,
 * certainty, a particular date — and a component that sorted by money would be
 * making that judgement on their behalf while looking like arithmetic.
 *
 * THE DIFFERENCE FROM THE ASKING PRICE IS COMPUTED, and shown as an amount and a
 * proportion: 5,000 under means something quite different on two properties an
 * order of magnitude apart.
 *
 * A WITHDRAWN OFFER STAYS VISIBLE. The history of what was offered and pulled is
 * exactly what a seller wants when deciding whether to trust the next one.
 */
export function OfferRow({ from, amount, askingPrice, conditions = [], madeOn, state = "open", currency = "GBP", locale = "en-GB", className }: {
  from: string;
  amount: number;
  /** Used only to compute the gap — never to rank. */
  askingPrice?: number;
  /** "Subject to survey", "needs to sell first". */
  conditions?: string[];
  madeOn?: string;
  state?: "open" | "accepted" | "declined" | "withdrawn";
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const gap = askingPrice !== undefined ? amount - askingPrice : undefined;
  const pct = askingPrice ? Math.round((Math.abs(gap ?? 0) / askingPrice) * 1000) / 10 : undefined;
  const gone = state === "withdrawn" || state === "declined";
  return (
    <li data-slot="offer-row" className={cn("space-y-0.5 px-3 py-2 text-sm", gone && "text-muted-foreground", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">{from}</span>
        <span className="shrink-0 font-medium tabular-nums">{money(amount)}</span>
      </p>
      {gap !== undefined && gap !== 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(Math.abs(gap))} {gap < 0 ? "under" : "over"} asking
          {pct !== undefined ? ` · ${pct}%` : ""}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {conditions.length > 0 ? `Subject to ${AND.format(conditions)}.` : "No conditions attached."}
      </p>
      <p className={cn("text-xs", state === "accepted" ? "font-medium" : "text-muted-foreground")}>
        {[
          state === "open" ? "Open" : state === "accepted" ? "Accepted" : state === "declined" ? "Declined" : "Withdrawn",
          madeOn,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </li>
  );
}
