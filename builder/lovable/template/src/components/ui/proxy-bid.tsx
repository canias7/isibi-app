import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Leaving a maximum — with what it will actually cost.
 *
 * THE MAXIMUM IS NOT THE PRICE, AND PEOPLE BELIEVE IT IS. A proxy bid pays only
 * enough to beat the next bidder, so somebody leaving £500 usually pays less —
 * and the number that catches them out is the OTHER direction: the premium and
 * tax on top, which take a £500 maximum to well over £600.
 *
 * THE TOTAL AT MAXIMUM IS COMPUTED AND SHOWN BEFORE CONFIRMING. That single
 * figure prevents most first-time-bidder complaints, and it is arithmetic the
 * house has always had.
 *
 * THE BID IS SNAPPED TO A VALID INCREMENT AND SAYS SO. A maximum between two
 * steps is silently rounded by the system, and a bidder who loses at £505
 * against £510 deserves to have known the rung was £500.
 *
 * IT IS A COMMITMENT AND SAYS SO. A proxy bid cannot be withdrawn once the lot
 * opens in most houses, and burying that turns a mistake into a dispute.
 */
export function ProxyBid({ value, onChange, increment, premiumPercent, taxOnPremiumPercent, currency = "GBP", locale = "en-GB", bindingNote, className }: {
  value: string;
  onChange: (next: string) => void;
  /** The bidding step at this level. */
  increment?: number;
  premiumPercent?: number;
  taxOnPremiumPercent?: number;
  currency?: string;
  locale?: string;
  bindingNote?: string;
  className?: string;
}) {
  const id = useId();
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const n = Number(value.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(n) && n > 0;
  const snapped = valid && increment ? Math.floor(n / increment) * increment : undefined;
  const offStep = snapped !== undefined && snapped !== n;
  const basis = snapped ?? (valid ? n : undefined);
  const total =
    basis !== undefined && premiumPercent !== undefined
      ? basis * (1 + (premiumPercent / 100) * (1 + (taxOnPremiumPercent ?? 0) / 100))
      : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">Your maximum</label>
      <Input id={id} value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        We bid only as much as it takes to stay ahead — you often pay less than this.
      </p>
      {offStep && snapped !== undefined && increment !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          Bidding goes in steps of {money(increment)}, so this becomes {money(snapped)}.
        </p>
      )}
      {total !== undefined && basis !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          If you win at {money(basis)} the invoice is about {money(total)} with the premium and tax.
        </p>
      )}
      <p className="text-xs">
        {bindingNote ?? "Once the lot opens this cannot be withdrawn."}
      </p>
    </div>
  );
}
