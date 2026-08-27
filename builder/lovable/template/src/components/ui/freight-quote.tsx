import { cn } from "@/lib/utils";
/**
 * A freight price, with everything that is not in it listed.
 *
 * THE EXCLUSIONS ARE THE QUOTE. Customs clearance, duty, waiting time, tail
 * lift, fuel surcharge and port charges routinely add half again to a headline
 * rate — and a quote showing only the rate is not comparable with one that
 * includes them. Naming the exclusions is what makes two quotes comparable at
 * all.
 *
 * IT SAYS WHAT THE RATE IS BASED ON. Chargeable weight is the greater of actual
 * and volumetric, so a light bulky load prices off a number nobody measured —
 * and the surprise appears on the invoice.
 *
 * THE VALIDITY DATE IS SHOWN, because freight rates move weekly and an expired
 * quote accepted in good faith becomes an argument.
 *
 * NO TOTAL IS INVENTED. Adding an estimate for the exclusions would produce a
 * number people quote back, and the honest answer is that those charges depend
 * on things not yet known.
 */
export function FreightQuote({ rate, basis, chargeableWeight, weightUnit = "kg", excludes = [], validUntil, incoterm, className }: {
  /** Pre-formatted headline rate. */
  rate: string;
  /** What it is charged on — "chargeable weight". */
  basis?: string;
  chargeableWeight?: number;
  weightUnit?: string;
  /** What is NOT included. */
  excludes?: string[];
  /** Free text — "14 August". */
  validUntil?: string;
  incoterm?: string;
  className?: string;
}) {
  return (
    <div data-slot="freight-quote" className={cn("space-y-1", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{rate}</span>
        {basis && <span className="text-muted-foreground"> · on {basis}</span>}
        {chargeableWeight !== undefined && (
          <span className="block text-xs tabular-nums text-muted-foreground">
            {chargeableWeight.toLocaleString()} {weightUnit} chargeable
          </span>
        )}
        {incoterm && <span className="block text-xs text-muted-foreground">Terms: {incoterm}</span>}
      </p>
      <div>
        <p className="text-xs font-medium">Not included</p>
        {excludes.length ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {excludes.map((e) => (
              <li key={e} className="flex gap-2"><span aria-hidden="true">·</span><span>{e}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nothing stated — ask what is excluded before comparing this with another quote.
          </p>
        )}
      </div>
      {validUntil && <p className="text-xs text-muted-foreground">Valid until {validUntil}.</p>}
    </div>
  );
}
