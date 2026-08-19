import { cn } from "@/lib/utils";
/**
 * What a tenant actually needs before they get the keys — totalled.
 *
 * THE TENANT FEES ACT BANNED ADMIN FEES IN 2019 AND TENANTS STILL ARRIVE
 * BRACED TO BE STUNG, because agents spent twenty years charging £300 to
 * "process" a form and the memory outlasted the law. Saying plainly that
 * nothing else is payable is worth more than any amount of "no hidden fees" —
 * it is a specific claim about specific charges rather than a slogan.
 *
 * THE TOTAL IS COMPUTED. Every figure here is derivable from the rent, and an
 * agent who states a total separately will eventually state one its own rows do
 * not support. Same rule as `investment-table` and `admission-prices`.
 *
 * AND THE HOLDING DEPOSIT IS PART OF THE FIRST MONTH, NOT ON TOP. It is set
 * against the rent when the tenancy starts, which almost nobody knows — so a
 * naive sum of the rows overstates the total by a week's rent, and this
 * subtracts it and says so. Getting that wrong in the reassuring direction is
 * the one arithmetic error this component must not make.
 *
 * THE CAPS ARE CHECKED, NOT TRUSTED. A deposit above five weeks' rent (six on
 * a tenancy over £50,000 a year) and a holding deposit above one week are
 * unlawful in England, and an agent typing a number into a CMS will eventually
 * type an unlawful one. The component says so rather than rendering it neatly.
 *
 * NOTHING IS COLOURED. The over-cap warning is a sentence at weight, because a
 * red border is invisible in greyscale and to a great many readers.
 */
export function TenancyCosts({
  monthlyRent, depositWeeks = 5, holdingWeeks = 1, currency = "GBP", locale = "en-GB",
  alsoPayable = [], heading = "What you pay before you move in", note, className,
}: {
  monthlyRent: number;
  /** Security deposit, in weeks of rent. Capped at 5 in England (6 above £50k/yr). */
  depositWeeks?: number;
  /** Holding deposit, in weeks. Capped at 1, and SET AGAINST the first month. */
  holdingWeeks?: number;
  currency?: string;
  locale?: string;
  /** Things genuinely payable during the tenancy — utilities, council tax. Not fees. */
  alsoPayable?: string[];
  heading?: string;
  note?: string;
  className?: string;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const weekly = (monthlyRent * 12) / 52;
  const deposit = Math.round(weekly * depositWeeks * 100) / 100;
  const holding = Math.round(weekly * holdingWeeks * 100) / 100;
  // The holding deposit comes OFF the first month rather than sitting on top of
  // it. Adding the rows naively overstates the total by a week, in the
  // direction that flatters nobody and surprises everybody.
  const total = Math.round((monthlyRent + deposit) * 100) / 100;
  const overCap = depositWeeks > 5 || holdingWeeks > 1;
  return (
    <div className={cn("", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="pb-3 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</caption>
          <thead>
            <tr className="border-b border-border text-start text-xs uppercase tracking-widest text-muted-foreground">
              <th scope="col" className="py-2 pe-4 font-medium">What</th>
              <th scope="col" className="py-2 text-end font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60 align-baseline">
              <th scope="row" className="py-3 pe-4 text-start font-[inherit]">
                <span className="font-medium">Holding deposit</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {holdingWeeks === 1 ? "One week's rent" : `${holdingWeeks} weeks' rent`}, paid to take
                  it off the market — and taken OFF your first month, not added to it
                </span>
              </th>
              <td className="py-3 text-end tabular-nums">{money(holding)}</td>
            </tr>
            <tr className="border-b border-border/60 align-baseline">
              <th scope="row" className="py-3 pe-4 text-start font-[inherit]">
                <span className="font-medium">First month's rent</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  Less the holding deposit you have already paid, so {money(monthlyRent - holding)} on the day
                </span>
              </th>
              <td className="py-3 text-end tabular-nums">{money(monthlyRent)}</td>
            </tr>
            <tr className="border-b border-border/60 align-baseline">
              <th scope="row" className="py-3 pe-4 text-start font-[inherit]">
                <span className="font-medium">Security deposit</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {depositWeeks} weeks' rent, protected in a government scheme within 30 days and
                  returned unless something is owed
                </span>
              </th>
              <td className="py-3 text-end tabular-nums">{money(deposit)}</td>
            </tr>
            <tr className="border-b-2 border-foreground align-baseline">
              <th scope="row" className="py-3 pe-4 text-start text-base font-semibold">Total before the keys</th>
              <td className="py-3 text-end text-base font-semibold tabular-nums">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* THE CAPS, CHECKED. An agent typing into a CMS will eventually type an
          unlawful number, and rendering it neatly is the worst outcome. */}
      {overCap && (
        <p className="mt-3 text-sm font-medium">
          One of these is above the legal cap — a deposit may not exceed five weeks&apos; rent, and a
          holding deposit may not exceed one. Check before publishing.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
        <p className="text-sm font-medium">And nothing else. That is the law, not our policy.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          No admin fee, no referencing fee, no inventory fee, no renewal fee and no charge for the
          tenancy agreement. The Tenant Fees Act 2019 prohibits all of them, and an agent asking for
          one is breaking the law rather than driving a hard bargain.
        </p>
        {alsoPayable.length > 0 && (
          <>
            <p className="mt-4 text-sm font-medium">What you do pay once you are in</p>
            <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-muted-foreground">
              {alsoPayable.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </>
        )}
      </div>
      {note && <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
