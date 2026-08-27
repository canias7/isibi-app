import { cn } from "@/lib/utils";
/**
 * One tariff — the standing charge as well as the unit rate.
 *
 * BOTH NUMBERS OR THE COMPARISON IS A LIE. A cheap unit rate with a high daily
 * standing charge beats a rival only above a certain consumption, and a table
 * showing unit rates alone recommends the wrong tariff to every low user —
 * which is disproportionately people who cannot afford the mistake.
 *
 * THE ANNUAL ESTIMATE IS SHOWN AT A STATED CONSUMPTION, and the consumption is
 * printed. An estimate whose assumption is hidden is the standard way price
 * comparison misleads, and the figure is meaningless to anyone whose use is
 * different.
 *
 * THE EXIT FEE AND THE END DATE ARE PART OF THE ROW. A fixed deal is a
 * commitment, and its cost is the fee for leaving early plus what happens when
 * it ends — which is usually a rollover onto a much worse rate.
 *
 * TIME-OF-USE RATES ARE SHOWN AS SEPARATE RATES, never averaged. An average
 * day/night rate describes nobody's actual bill.
 */
export type UnitRate = { id: string; label?: string; pencePerUnit: number };

export function TariffRow({ name, unitRates, standingChargePence, estimateAt, estimateAnnual, endsOn, exitFee, currency = "GBP", locale = "en-GB", unit = "kWh", className }: {
  name: string;
  /** One entry, or several for a time-of-use tariff. */
  unitRates: UnitRate[];
  /** Daily standing charge in pence. */
  standingChargePence?: number;
  /** The consumption the estimate assumes. */
  estimateAt?: number;
  /** Annual cost at that consumption, in major units. */
  estimateAnnual?: number;
  /** Free text — "31 March 2027". */
  endsOn?: string;
  /** Cost of leaving early, in major units. */
  exitFee?: number;
  currency?: string;
  locale?: string;
  unit?: string;
  className?: string;
}) {
  // Pennies only where there are pennies. "£845.00 a year" claims a precision an
  // estimate does not have, and "£75.00 to leave early" is a round fee typed out
  // long — but a genuine £74.50 must still show.
  // Decided PER VALUE, not by a blanket minimum: a blanket 0 renders £74.50 as
  // "£74.5", which reads as a typo.
  const money = (v: number) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
  return (
    <li data-slot="tariff-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1 font-medium">{name}</span>
        {estimateAnnual !== undefined && (
          <span className="shrink-0 tabular-nums">{money(estimateAnnual)} a year</span>
        )}
      </p>
      <ul className="text-xs tabular-nums text-muted-foreground">
        {unitRates.map((r) => (
          <li key={r.id}>
            {r.label ? `${r.label}: ` : ""}{r.pencePerUnit}p per {unit}
          </li>
        ))}
        {standingChargePence !== undefined && <li>{standingChargePence}p a day standing charge</li>}
      </ul>
      {estimateAnnual !== undefined && estimateAt !== undefined && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Estimated at {estimateAt.toLocaleString()} {unit} a year — yours will differ.
        </p>
      )}
      {(endsOn || exitFee !== undefined) && (
        <p className="text-xs">
          {endsOn && `Fixed until ${endsOn}`}
          {endsOn && exitFee !== undefined ? " · " : ""}
          {exitFee !== undefined && (exitFee > 0 ? `${money(exitFee)} to leave early` : "No exit fee")}
        </p>
      )}
    </li>
  );
}
