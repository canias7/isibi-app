import { cn } from "@/lib/utils";
/**
 * The same thing priced by PERIOD — a day, three days, a week, a month.
 *
 * A SINGLE HEADLINE RATE IS A QUOTE NOBODY EVER GETS. Hire, care and anything
 * else sold by time is priced in blocks, and "£45 a day" is the number that
 * makes somebody expect £315 for a week when the week is £180. Publishing one
 * figure is not simpler; it is a conversation the customer has to have at the
 * counter, in the direction that annoys them.
 *
 * THE PER-DAY EQUIVALENT IS COMPUTED, not taken. It is the number people
 * actually compare on, and stored separately it drifts from the price the
 * moment somebody puts the rates up — the `league-table` rule again. That also
 * makes the break-even visible without anybody doing arithmetic: three days at
 * £40 and a week at £22 is the whole argument for taking the week.
 *
 * THE BEST VALUE ROW IS MARKED IN WORDS AT WEIGHT, and it is DERIVED from the
 * per-day figures rather than chosen by the caller — a business marking its
 * dearest block "best value" is exactly what this component should make
 * impossible. Where a row wins on a genuine tie it is left unmarked.
 *
 * BANDS ARE OPTIONAL COLUMNS: weekday, weekend, bank holiday. Home care is
 * priced that way and so is party hire, and a component that only does one
 * dimension pushes the second into a footnote nobody reads.
 *
 * WHEN EVERY ROW IS ONE UNIT, THE PER-UNIT COLUMN AND THE BADGE BOTH GO. That
 * is not tidying: with all `units: 1` the derived figure is a character-for-
 * character copy of the price beside it, and "cheapest per visit" stops meaning
 * better value and starts meaning cheapest — which, across a list of DIFFERENT
 * things (a swim, a squash court, the whole sports hall), is a recommendation
 * the component has no business making. Measured on a real leisure centre page:
 * the table marked swimming as the best value against hiring a hall.
 */
export type Rate = {
  /** "A day", "Three days", "A week", "60 minutes". */
  period: string;
  /** How many days (or hours) this period is, for the per-unit figure. */
  units: number;
  /** Price for the period. With bands, the price for the FIRST band. */
  price: number;
  /** Prices for the remaining bands, in the same order as `bands`. */
  more?: number[];
  note?: string | null;
};
export function RateCard({
  rates, bands, unit = "day", label = "Hire for", currency = "GBP", locale = "en-GB", caption, note, className,
}: {
  rates: Rate[];
  /** Column headings after the first: ["Weekday", "Weekend"]. Omit for one price. */
  bands?: string[];
  /** What `units` counts, for the derived line: "day", "hour". */
  unit?: string;
  /** Heading over the first column. "Hire for" is wrong on anything not hired. */
  label?: string;
  currency?: string;
  locale?: string;
  caption?: string;
  note?: string;
  className?: string;
}) {
  if (!rates.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const perUnit = (r: Rate) => (r.units > 0 ? r.price / r.units : Infinity);
  // All-one-unit means the derived column is a copy of the price column and the
  // badge is comparing unlike things. Both go rather than say something false.
  const blocks = rates.some((r) => r.units !== 1);
  const cheapest = Math.min(...rates.map(perUnit));
  // A genuine tie wins nothing: two rows at the same per-day figure are not a
  // recommendation, and marking both says less than marking neither.
  const winners = rates.filter((r) => perUnit(r) === cheapest);
  const best = blocks && winners.length === 1 ? winners[0] : null;
  const cols = bands ?? [];
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="pb-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">{label}</th>
            <th scope="col" className={cn("py-2 text-right font-medium", (blocks || cols.length > 1) && "pr-4")}>{cols[0] ?? "Price"}</th>
            {cols.slice(1).map((b, i) => (
              <th key={b} scope="col" className={cn("py-2 text-right font-medium", (blocks || i < cols.length - 2) && "pr-4")}>{b}</th>
            ))}
            {blocks && <th scope="col" className="py-2 text-right font-medium">Per {unit}</th>}
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.period} className="border-b border-border/60 align-baseline">
              <th scope="row" className="py-3 pr-4 text-left font-[inherit]">
                <span className={cn(r === best && "font-semibold")}>{r.period}</span>
                {r === best && (
                  <span className="ml-2 text-xs font-medium uppercase tracking-widest">Cheapest per {unit}</span>
                )}
                {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
              </th>
              <td className={cn("py-3 text-right tabular-nums", (blocks || cols.length > 1) && "pr-4", r === best && "font-semibold")}>{money(r.price)}</td>
              {cols.slice(1).map((b, i) => (
                <td key={b} className={cn("py-3 text-right tabular-nums", (blocks || i < cols.length - 2) && "pr-4")}>
                  {typeof r.more?.[i] === "number"
                    ? money(r.more[i])
                    : <><span aria-hidden="true" className="text-muted-foreground">—</span><span className="sr-only">not available</span></>}
                </td>
              ))}
              {blocks && (
                <td className="py-3 text-right tabular-nums text-muted-foreground">
                  {Number.isFinite(perUnit(r)) ? money(Math.round(perUnit(r) * 100) / 100) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
