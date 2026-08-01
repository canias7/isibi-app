import { cn } from "@/lib/utils";
/**
 * A valuation, with the two things that make it mean anything.
 *
 * A VALUATION WITHOUT ITS DATE AND ITS BASIS IS A NUMBER SOMEBODY SAID. The
 * same property has different values for a sale, for a mortgage, for insurance
 * and for a forced sale — they are not estimates of one another and a figure
 * quoted without its basis will be used for the wrong one.
 *
 * THE COMPARABLE SALES ARE NAMED. A valuation is an argument from evidence, and
 * the evidence is what lets a seller tell a careful figure from a flattering one.
 * An agent's number with no comparables behind it is a pitch.
 *
 * WHO VALUED IT AND WHAT THEY GAIN. An agent hoping to win the instruction and a
 * surveyor paid a flat fee have different reasons to be optimistic, and the
 * reader should not have to know the industry to see that.
 *
 * IT AGES VISIBLY. A valuation from eighteen months ago is presented as an old
 * number, because that is what it is, and nothing about the layout should make
 * it look current.
 */
export function ValuationNote({ amount, basis = "sale", valuedOn, monthsOld, valuedBy, valuerInterest, comparables = [], currency = "GBP", locale = "en-GB", className }: {
  amount: number;
  /** These are not estimates of one another. */
  basis?: "sale" | "mortgage" | "insurance" | "quick sale" | "rental";
  valuedOn?: string;
  /** How old it is, in months. */
  monthsOld?: number;
  valuedBy?: string;
  /** What the valuer stands to gain, if anything. */
  valuerInterest?: string;
  /** The evidence. A figure with none is a pitch. */
  comparables?: { id: string; what: string; amount: number }[];
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const stale = monthsOld !== undefined && monthsOld >= 6;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className={cn("tabular-nums", stale ? "text-muted-foreground" : "")}>
        <span className="text-lg font-medium">{money(amount)}</span>
        <span className="text-muted-foreground"> · for {basis}</span>
      </p>
      {(valuedOn || monthsOld !== undefined) && (
        <p className={cn("text-xs tabular-nums", stale ? "font-medium" : "text-muted-foreground")}>
          {/* Zero months is not an age, and "0 months ago" beside "last week" is
              the component contradicting the field next to it. */}
          {[
            valuedOn && `Valued ${valuedOn}`,
            monthsOld !== undefined && monthsOld > 0 && `${monthsOld} ${monthsOld === 1 ? "month" : "months"} ago`,
          ]
            .filter(Boolean)
            .join(" · ")}
          {stale ? " — old enough that it is a starting point, not a price." : ""}
        </p>
      )}
      {comparables.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {comparables.map((c) => (
            <li key={c.id} className="tabular-nums">
              {c.what} — {money(c.amount)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs">No comparable sales given. A figure with no evidence behind it is a pitch.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {[valuedBy && `By ${valuedBy}`, valuerInterest].filter(Boolean).join(" · ")}
      </p>
      <p className="text-xs text-muted-foreground">
        A {basis} valuation. It is not the figure any of the others would give.
      </p>
    </div>
  );
}
