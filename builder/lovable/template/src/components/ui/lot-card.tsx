import { cn } from "@/lib/utils";
/**
 * A lot in a sale — with the total cost, not the hammer price.
 *
 * THE ESTIMATE IS A RANGE AND IS NOT A VALUATION. Estimates are set to attract
 * bidding and are routinely exceeded or missed by a wide margin, and a bidder
 * treating one as a price guide bids badly in both directions.
 *
 * THE PREMIUM AND TAX ARE SHOWN AT THE POINT OF BIDDING. A first-time bidder
 * who wins at their limit and then receives an invoice a quarter higher feels
 * cheated, and the arithmetic was available all along.
 *
 * "SOLD" DOES NOT MEAN THE ESTIMATE WAS RIGHT. Where a lot sold, the hammer
 * price is the fact — the estimate beside it is context, and it is what tells a
 * bidder how much estimates in this sale are worth.
 *
 * THE CONDITION REPORT IS LINKED, not summarised. A photograph and a sentence
 * are what get somebody to bid; the report is what stops them regretting it,
 * and paraphrasing it is how a dispute starts.
 */
export function LotCard({ lotNumber, title, maker, estimateLow, estimateHigh, currentBid, hammerPrice, premiumPercent, taxOnPremiumPercent, sold, conditionReportNote, currency = "GBP", locale = "en-GB", className }: {
  lotNumber: string | number;
  title: string;
  maker?: string;
  estimateLow?: number;
  estimateHigh?: number;
  currentBid?: number;
  /** Set once it has sold. */
  hammerPrice?: number;
  premiumPercent?: number;
  taxOnPremiumPercent?: number;
  sold?: boolean;
  conditionReportNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const base = hammerPrice ?? currentBid;
  const total =
    base !== undefined && premiumPercent !== undefined
      ? base * (1 + (premiumPercent / 100) * (1 + (taxOnPremiumPercent ?? 0) / 100))
      : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="text-xs tabular-nums text-muted-foreground">Lot {lotNumber}</span>
        <span className="block font-medium">{title}</span>
        {maker && <span className="block text-xs text-muted-foreground">{maker}</span>}
      </p>
      {estimateLow !== undefined && estimateHigh !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Estimate {money(estimateLow)}–{money(estimateHigh)} — a guide for bidding, not a valuation.
        </p>
      )}
      {base !== undefined && (
        <p className="tabular-nums">
          <span className="font-medium">{money(base)}</span>
          <span className="text-muted-foreground"> {sold || hammerPrice !== undefined ? "hammer" : "current bid"}</span>
        </p>
      )}
      {total !== undefined && premiumPercent !== undefined && (
        <p className="text-xs tabular-nums">
          You would pay about {money(total)} — {premiumPercent}% premium
          {taxOnPremiumPercent ? ` and ${taxOnPremiumPercent}% tax on it` : ""} on top.
        </p>
      )}
      {conditionReportNote && <p className="text-xs">{conditionReportNote}</p>}
    </div>
  );
}
