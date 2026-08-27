import { cn } from "@/lib/utils";
/**
 * A bundle, priced honestly over the contract rather than for the first month.
 *
 * THE HEADLINE PRICE AND THE PRICE AFTER THE OFFER ARE BOTH SHOWN. A bundle sold
 * at an introductory rate and renewing at twice it is the normal shape of this
 * product, and a row showing one number is advertising rather than information.
 *
 * THE AVERAGE OVER THE WHOLE CONTRACT IS COMPUTED. It is the only figure that
 * lets two bundles with different offer lengths be compared at all, and no
 * provider publishes it because it is never the flattering one.
 *
 * PARTS THAT CAN BE DROPPED ARE MARKED. Half a bundle is usually a television
 * package somebody does not want, and knowing which parts are severable is what
 * makes the price negotiable.
 *
 * NO SAVING AGAINST A LIST PRICE. "Save £240" is measured against a number
 * nobody pays, which makes it the least meaningful figure that can be printed.
 */
export type BundlePart = { id: string; what: string; optional?: boolean };

export function BundleRow({ name, parts = [], monthlyPrice, offerMonths, priceAfterOffer, contractMonths, upfrontCost, currency = "GBP", locale = "en-GB", className }: {
  name: string;
  parts?: BundlePart[];
  monthlyPrice: number;
  /** How long the introductory price lasts. */
  offerMonths?: number;
  priceAfterOffer?: number;
  contractMonths?: number;
  upfrontCost?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  // The only figure that compares two bundles with different offer lengths, and
  // the reason no provider prints it.
  let average: number | undefined;
  if (contractMonths && priceAfterOffer !== undefined && offerMonths !== undefined) {
    const offer = Math.min(offerMonths, contractMonths);
    const rest = Math.max(0, contractMonths - offer);
    average = (monthlyPrice * offer + priceAfterOffer * rest + (upfrontCost ?? 0)) / contractMonths;
  }
  const optional = parts.filter((p) => p.optional);
  return (
    <li data-slot="bundle-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{name}</span>
        <span className="shrink-0 tabular-nums">{money(monthlyPrice)}/mo</span>
      </p>
      {parts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {parts.map((p) => `${p.what}${p.optional ? " (can be dropped)" : ""}`).join(" · ")}
        </p>
      )}
      {priceAfterOffer !== undefined && offerMonths !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          {money(monthlyPrice)} for {offerMonths} {offerMonths === 1 ? "month" : "months"}, then{" "}
          {money(priceAfterOffer)}.
        </p>
      )}
      {average !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Averages {money(average)} a month over the {contractMonths}-month contract
          {upfrontCost ? `, including ${money(upfrontCost)} up front` : ""}. That is the figure to compare.
        </p>
      )}
      {optional.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {optional.length} {optional.length === 1 ? "part" : "parts"} can be taken out — worth asking the price
          without.
        </p>
      )}
    </li>
  );
}
