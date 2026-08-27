import { cn } from "@/lib/utils";
/**
 * What a lot made — as a result, with the estimate it was measured against.
 *
 * UNSOLD IS A RESULT AND IS PUBLISHED AS ONE. A results list showing only sold
 * lots overstates a sale enormously, and the unsold rate is the single most
 * informative number about how a category is doing.
 *
 * THE ESTIMATE IS SHOWN BESIDE THE HAMMER SO THE READER CAN JUDGE BOTH. A price
 * three times the top estimate says as much about the estimate as about the
 * object, and a results page hiding it is marketing rather than a record.
 *
 * PREMIUM-INCLUSIVE AND HAMMER FIGURES ARE LABELLED, ALWAYS. Houses publish
 * different ones, they differ by a quarter, and unlabelled comparisons between
 * sales are worthless — which is most price research anybody does.
 *
 * A PRICE PAID BY THE SELLER'S OWN AGENT IS DISCLOSED where the caller knows.
 * It is a real practice, it is not a market price, and treating it as one
 * corrupts every comparable that follows.
 */
export function HammerPrice({ lotNumber, title, sold, hammer, estimateLow, estimateHigh, includingPremium, boughtIn, currency = "GBP", locale = "en-GB", className }: {
  lotNumber?: string | number;
  title?: string;
  sold: boolean;
  hammer?: number;
  estimateLow?: number;
  estimateHigh?: number;
  /** The premium-inclusive figure, where published. */
  includingPremium?: number;
  /** True where it did not find a buyer. */
  boughtIn?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const over = hammer !== undefined && estimateHigh !== undefined && hammer > estimateHigh;
  const under = hammer !== undefined && estimateLow !== undefined && hammer < estimateLow;
  return (
    <li data-slot="hammer-price" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {lotNumber !== undefined && (
            <span className="text-xs tabular-nums text-muted-foreground">Lot {lotNumber} · </span>
          )}
          {title}
        </span>
        <span className={cn("shrink-0 tabular-nums", sold ? "font-medium" : "")}>
          {sold && hammer !== undefined ? money(hammer) : "Unsold"}
        </span>
      </p>
      {sold && hammer !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Hammer price
          {includingPremium !== undefined && ` · ${money(includingPremium)} with the premium`}
        </p>
      )}
      {estimateLow !== undefined && estimateHigh !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Estimated {money(estimateLow)}–{money(estimateHigh)}
          {over ? " — above the top estimate" : under ? " — below the low estimate" : ""}
        </p>
      )}
      {!sold && (
        <p className="text-xs">
          It did not sell. Unsold lots are published here because leaving them out would flatter the sale.
        </p>
      )}
      {boughtIn && (
        <p className="text-xs font-medium">
          Bought in — this is not a market price and should not be used as a comparable.
        </p>
      )}
    </li>
  );
}
