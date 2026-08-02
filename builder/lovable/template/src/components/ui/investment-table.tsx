import { cn } from "@/lib/utils";
/**
 * What it really costs to open — the parts, TOTALLED, and what is left out.
 *
 * "FROM £14,995" IS THE FRANCHISE FEE AND THE REAL NUMBER IS THREE TIMES IT.
 * That is the whole component. Every franchise site in the country leads with
 * the fee, and a prospect who reads it as the cost of starting discovers the
 * van, the stock, the fit-out and six months of living expenses somewhere
 * around the third meeting — by which point they have spent a fortnight on it.
 * Adding it up on the page loses the prospects who were never funded and keeps
 * the ones who are, which is the trade a franchisor should want.
 *
 * THE TOTAL IS COMPUTED FROM THE ROWS, never taken. Stored separately it drifts
 * the moment one line moves, always downwards, and a franchisor quoting a total
 * its own breakdown does not support is exactly what this should make
 * impossible. Same rule as `admission-prices` and `direct-saving`.
 *
 * A RANGE, NOT A POINT, where a line genuinely varies. Fit-out on a unit
 * depends on the unit; printing a single figure for it is a number somebody
 * will hold you to, and printing "varies" is useless. `to` makes the range the
 * honest default and the total then reads as a range too.
 *
 * `excludes` IS AS IMPORTANT AS THE ROWS AND IS REQUIRED TO BE VISIBLE. Rent,
 * a vehicle, VAT, and — the one that ends more franchises than any other —
 * money to live on until the business pays you. A cost list with no exclusions
 * reads as complete, and its incompleteness is discovered in month four.
 *
 * `fundable` IS STATED SEPARATELY BECAUSE IT IS THE REAL QUESTION. Most
 * prospects cannot write the total cheque and the banks lend against these at a
 * known ratio; "£62,000 total, and the banks typically lend 70% of it" is the
 * sentence that turns a browser into an applicant, and hiding it makes the
 * total look like a wall.
 */
export type CostLine = {
  what: string;
  amount: number;
  /** Upper bound where the line genuinely varies. A point figure for a fit-out is a lie. */
  to?: number | null;
  detail?: string | null;
};
export function InvestmentTable({
  lines, excludes, fundablePercent, currency = "GBP", locale = "en-GB",
  heading = "What it costs to open", note, className,
}: {
  lines: CostLine[];
  /** REQUIRED to be useful: what the total does NOT cover. Rent, VAT, living costs. */
  excludes: string[];
  /** Typical bank lending against this, as a percentage. The question behind the total. */
  fundablePercent?: number | null;
  currency?: string;
  locale?: string;
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!lines.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  // COMPUTED. A total the breakdown does not support is the thing this exists
  // to prevent, and it only ever drifts downwards.
  const low = lines.reduce((s, l) => s + l.amount, 0);
  const high = lines.reduce((s, l) => s + (typeof l.to === "number" ? l.to : l.amount), 0);
  const ranged = high > low;
  const total = ranged ? `${money(low)} – ${money(high)}` : money(low);
  return (
    <div className={cn("", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="pb-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">What</th>
              <th scope="col" className="py-2 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.what} className="border-b border-border/60 align-baseline">
                <th scope="row" className="py-3 pr-4 text-left font-[inherit]">
                  <span className="font-medium">{l.what}</span>
                  {l.detail && <span className="block text-xs leading-relaxed text-muted-foreground">{l.detail}</span>}
                </th>
                <td className="py-3 text-right tabular-nums">
                  {typeof l.to === "number" && l.to > l.amount ? `${money(l.amount)} – ${money(l.to)}` : money(l.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-b-2 border-foreground align-baseline">
              <th scope="row" className="py-3 pr-4 text-left text-base font-semibold">To open</th>
              <td className="py-3 text-right text-base font-semibold tabular-nums">{total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {typeof fundablePercent === "number" && (
        <p className="mt-4 text-sm">
          <span className="font-medium">Banks typically lend {fundablePercent}% of it</span>
          <span className="text-muted-foreground">
            {" "}— about {money(Math.round((low * (100 - fundablePercent)) / 100))} of your own money
            {ranged ? ` at the bottom of that range` : ""}. We will introduce you to two who know the model;
            neither pays us and neither is obliged to say yes.
          </span>
        </p>
      )}

      {/* AS IMPORTANT AS THE ROWS. A cost list with no exclusions reads as
          complete, and its incompleteness turns up in month four. */}
      {excludes.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
          <p className="text-sm font-medium">What that figure does not include</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {excludes.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
      {note && <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
