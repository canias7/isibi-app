import { cn } from "@/lib/utils";
/**
 * What a week actually costs, with the funded hours already taken off.
 *
 * THE DEDUCTION IS APPLIED, NOT EXPLAINED. This is the whole component. Every
 * nursery site prints "£312 a week" and then a paragraph about the 15 and 30
 * hour entitlements, and leaves a parent to work out what they will really pay
 * — which they get wrong, and which is the number they are choosing on. Here
 * the funded column holds the answer and the full price stays beside it, so
 * nothing is hidden and nothing has to be computed by the reader.
 *
 * THE HOURLY RATE IS DERIVED FROM THE ROW, not taken as a separate field. A
 * table that stores a weekly price AND an hourly rate eventually disagrees with
 * itself, because somebody puts the fees up and corrects one of them. Same
 * reasoning as the goal difference in `league-table`.
 *
 * `extraPerWeek` EXISTS BECAUSE THE FUNDING DOES NOT COVER EVERYTHING, and a
 * component that pretended it did would print a number the parent does not pay.
 * Nappies, meals and the consumables charge are real, they are chargeable on
 * top of funded hours, and leaving them out is the same dishonesty in the other
 * direction.
 *
 * FULLY COVERED SAYS "Free", not "£0.00". A zero-priced row reads as a bug and
 * gets rung up about; the word does not.
 *
 * ELIGIBILITY IS ON EVERY ROW. A band that the entitlement does not reach says
 * so in its own funded cell rather than being explained under the table — the
 * footnote is exactly what this component exists to remove.
 */
export type FeeRow = {
  /** Age band: "Under 2", "2 years", "3–4 years". */
  band: string;
  /** Pattern: "Five mornings", "Three full days". */
  pattern: string;
  hoursPerWeek: number;
  pricePerWeek: number;
};
export function FeeTable({
  rows, funding, currency = "GBP", locale = "en-GB", caption, note, className,
}: {
  rows: FeeRow[];
  /** Omit and no funded column is shown at all. */
  funding?: {
    /** Column heading: "With 30 funded hours". */
    label: string;
    hoursPerWeek: number;
    /** The bands it reaches. A band not listed says so on its own row. */
    bands: string[];
    /** Meals, nappies, consumables — chargeable on top of funded hours. */
    extraPerWeek?: number;
    /** What the extra is for, said once: "meals and nappies". */
    extraFor?: string;
  };
  currency?: string;
  locale?: string;
  caption?: string;
  note?: string;
  className?: string;
}) {
  if (!rows.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const funded = (r: FeeRow) => {
    if (!funding) return null;
    if (!funding.bands.includes(r.band)) return { eligible: false as const };
    const hourly = r.hoursPerWeek > 0 ? r.pricePerWeek / r.hoursPerWeek : 0;
    const paidHours = Math.max(0, r.hoursPerWeek - funding.hoursPerWeek);
    const total = paidHours * hourly + (funding.extraPerWeek ?? 0);
    return { eligible: true as const, total, paidHours };
  };
  return (
    <div data-slot="fee-table" className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="pb-3 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-start text-xs uppercase tracking-widest text-muted-foreground">
            <th scope="col" className="py-2 pe-4 font-medium">Age</th>
            <th scope="col" className="py-2 pe-4 font-medium">Pattern</th>
            <th scope="col" className="py-2 pe-4 text-end font-medium">Hours</th>
            <th scope="col" className="py-2 pe-4 text-end font-medium">Full price</th>
            {funding && <th scope="col" className="py-2 text-end font-medium">{funding.label}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const f = funded(r);
            return (
              <tr key={r.band + r.pattern} className="border-b border-border/60 align-baseline">
                <th scope="row" className="py-3 pe-4 text-start font-[inherit]">{r.band}</th>
                <td className="py-3 pe-4">{r.pattern}</td>
                <td className="py-3 pe-4 text-end tabular-nums">{r.hoursPerWeek}</td>
                <td className="py-3 pe-4 text-end tabular-nums text-muted-foreground">{money(r.pricePerWeek)} a week</td>
                {funding && (
                  <td className="py-3 text-end tabular-nums">
                    {!f?.eligible ? (
                      <span className="text-muted-foreground">Not eligible at this age</span>
                    ) : f.total <= 0 ? (
                      <span className="font-semibold">Free</span>
                    ) : (
                      <>
                        <span className="font-semibold">{money(f.total)} a week</span>
                        {f.paidHours > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {f.paidHours} hour{f.paidHours === 1 ? "" : "s"} above the entitlement
                          </span>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {(funding?.extraPerWeek || note) && (
        <p className="mt-3 text-sm text-muted-foreground">
          {funding?.extraPerWeek
            ? `The funded figure includes ${money(funding.extraPerWeek)} a week for ${funding.extraFor ?? "meals and consumables"}, which the entitlement does not cover.`
            : null}
          {funding?.extraPerWeek && note ? " " : null}
          {note}
        </p>
      )}
    </div>
  );
}
