import { cn } from "@/lib/utils";
/**
 * The premium, worked through — including the bands.
 *
 * THE PREMIUM IS USUALLY BANDED AND ALMOST NOBODY KNOWS. 26% to the first
 * £20,000 and 20% above it is the ordinary shape, and quoting a single
 * percentage is wrong at every price except one. The working is the component.
 *
 * TAX ON THE PREMIUM IS A SEPARATE LINE. It is charged on the premium rather
 * than the hammer price in most jurisdictions, which is not obvious and moves
 * the total by several percent.
 *
 * OTHER CHARGES ARE INCLUDED WHERE THEY EXIST. Artist's resale royalty, import
 * charges and storage all land on the same invoice, and a total that omits them
 * is the number people budget to.
 *
 * THE TOTAL IS COMPUTED FROM THE LINES, never supplied. On an invoice
 * breakdown, a total that disagrees with its own components is the one thing a
 * buyer will never accept.
 */
export type PremiumBand = { id: string; upTo?: number; percent: number };

export function BuyersPremium({ hammerPrice, bands, taxOnPremiumPercent, otherCharges = [], currency = "GBP", locale = "en-GB", className }: {
  hammerPrice: number;
  /** Lowest band first; the last may omit `upTo`. */
  bands: PremiumBand[];
  taxOnPremiumPercent?: number;
  /** Royalties, import charges, storage. */
  otherCharges?: { id: string; label: string; amount: number }[];
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  let remaining = hammerPrice;
  let previousCap = 0;
  const applied = bands.map((b, i) => {
    const cap = b.upTo ?? Infinity;
    const from = previousCap;
    const slice = Math.max(0, Math.min(remaining, cap - previousCap));
    remaining -= slice;
    previousCap = cap;
    // The band is described as a RANGE, not by repeating its own slice. Printing
    // "26% on £20,000" above "to £20,000" reads as a cap that says nothing.
    return { ...b, slice, from, first: i === 0, amount: slice * (b.percent / 100) };
  }).filter((b) => b.slice > 0);
  const premium = applied.reduce((n, b) => n + b.amount, 0);
  const tax = taxOnPremiumPercent ? premium * (taxOnPremiumPercent / 100) : 0;
  const others = otherCharges.reduce((n, c) => n + c.amount, 0);
  // Computed from the lines: a total that disagrees with its own breakdown is
  // the one thing a buyer will never let go of.
  const total = hammerPrice + premium + tax + others;
  return (
    <div className={cn("space-y-1", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        <li className="flex items-baseline gap-3 px-3 py-1.5">
          <span className="min-w-0 flex-1">Hammer price</span>
          <span className="shrink-0 tabular-nums">{money(hammerPrice)}</span>
        </li>
        {applied.map((b) => (
          <li key={b.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1 text-muted-foreground">
              {b.percent}% on {b.first ? "the first" : "the next"} {money(b.slice)}
              <span className="block text-xs">
                {b.first ? `up to ${money(b.from + b.slice)}` : `from ${money(b.from)} to ${money(b.from + b.slice)}`}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{money(b.amount)}</span>
          </li>
        ))}
        {tax > 0 && (
          <li className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1 text-muted-foreground">
              {taxOnPremiumPercent}% tax on the premium, not on the hammer price
            </span>
            <span className="shrink-0 tabular-nums">{money(tax)}</span>
          </li>
        )}
        {otherCharges.map((c) => (
          <li key={c.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1 text-muted-foreground">{c.label}</span>
            <span className="shrink-0 tabular-nums">{money(c.amount)}</span>
          </li>
        ))}
        <li className="flex items-baseline gap-3 px-3 py-1.5 font-medium">
          <span className="min-w-0 flex-1">To pay</span>
          <span className="shrink-0 tabular-nums">{money(total)}</span>
        </li>
      </ul>
      {bands.length > 1 && (
        <p className="text-xs text-muted-foreground">
          The premium is banded, so a single percentage would be wrong at every price but one.
        </p>
      )}
    </div>
  );
}
