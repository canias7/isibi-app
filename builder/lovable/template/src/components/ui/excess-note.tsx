import { cn } from "@/lib/utils";
/**
 * What a claim costs the policyholder before anything is paid.
 *
 * COMPULSORY AND VOLUNTARY EXCESSES ADD UP AND THE TOTAL IS WHAT IS SHOWN.
 * People choose a voluntary excess to lower a premium and then remember only
 * that number; the sum is what is deducted, and it is routinely double what
 * they expect.
 *
 * PER-CLAIM-TYPE EXCESSES ARE SHOWN SEPARATELY. Subsidence and escape of water
 * commonly carry their own, far larger figure, and the general excess on the
 * front of the policy is not the one that applies.
 *
 * IT SHOWS WHETHER A SMALL CLAIM IS WORTH MAKING. Where the loss is close to
 * the excess, claiming costs the no-claims discount and pays almost nothing —
 * and the component says so, which is against the insurer's short-term interest
 * and right.
 *
 * IT IS DEDUCTED FROM THE SETTLEMENT, not paid up front, and saying which is
 * the difference between somebody claiming and not.
 */
export function ExcessNote({ compulsory = 0, voluntary = 0, forThisClaimType, claimTypeLabel, estimatedLoss, affectsNoClaims, currency = "GBP", locale = "en-GB", className }: {
  compulsory?: number;
  voluntary?: number;
  /** A different, usually larger figure for this peril. */
  forThisClaimType?: number;
  claimTypeLabel?: string;
  /** What the claim is thought to be worth. */
  estimatedLoss?: number;
  affectsNoClaims?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
  const applies = forThisClaimType ?? compulsory + voluntary;
  const marginal = estimatedLoss !== undefined && estimatedLoss <= applies * 1.5;
  return (
    <div data-slot="excess-note" className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{money(applies)}</span>
        <span className="text-muted-foreground"> comes off any settlement</span>
      </p>
      {forThisClaimType !== undefined ? (
        <p className="text-xs tabular-nums">
          That is the {claimTypeLabel ?? "claim-specific"} excess, which replaces the usual {money(compulsory + voluntary)}.
        </p>
      ) : (
        <p className="text-xs tabular-nums text-muted-foreground">
          {money(compulsory)} compulsory + {money(voluntary)} you chose
        </p>
      )}
      {estimatedLoss !== undefined && (
        <p className={cn("text-xs tabular-nums", marginal ? "font-medium" : "text-muted-foreground")}>
          {estimatedLoss <= applies
            ? `A ${money(estimatedLoss)} loss is below the excess — there would be nothing to pay you.`
            : `On a ${money(estimatedLoss)} loss you would receive about ${money(estimatedLoss - applies)}.`}
        </p>
      )}
      {marginal && affectsNoClaims && (
        <p className="text-xs">
          Claiming would also cost your no-claims discount. For a claim this size that is often the worse deal.
        </p>
      )}
      <p className="text-xs text-muted-foreground">You do not pay this up front — it is deducted from what we pay you.</p>
    </div>
  );
}
