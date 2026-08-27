import { cn } from "@/lib/utils";
/**
 * Moving to another supplier — what happens, and what is still owed.
 *
 * THE SAVING IS SHOWN AGAINST A STATED CONSUMPTION AND AGAINST THE CURRENT
 * TARIFF, not against a market average. A saving figure with hidden assumptions
 * is the standard way switching is oversold, and the customer discovers it a
 * quarter later.
 *
 * THE COOLING-OFF PERIOD IS STATED, because it is the answer to "have I just
 * made a mistake" and it exists precisely for people who feel rushed.
 *
 * A FINAL BILL IS COMING AND THE COMPONENT SAYS SO. People believe switching
 * ends the relationship; the old supplier bills for what was used, and an
 * unexpected final bill on a closed account is the commonest complaint about
 * the whole process.
 *
 * NOTHING ABOUT THE SUPPLY PHYSICALLY CHANGES, which is worth saying: no
 * engineer, no interruption, no meter change. It is the fear that stops people
 * switching and it is unfounded.
 */
export function SwitchSupplier({ from, to, tariff, switchOn, coolingOffDays = 14, exitFee, estimatedSaving, savingAt, currency = "GBP", locale = "en-GB", unit = "kWh", className }: {
  from?: string;
  to: string;
  tariff?: string;
  /** Free text — "14 August". */
  switchOn?: string;
  coolingOffDays?: number;
  /** Charged by the old supplier, in major units. */
  exitFee?: number;
  /** Annual, in major units. */
  estimatedSaving?: number;
  /** The consumption that saving assumes. */
  savingAt?: number;
  currency?: string;
  locale?: string;
  unit?: string;
  className?: string;
}) {
  // Same rule as `tariff-row`: these are estimates and round fees, so pennies
  // appear only when the figure actually has them.
  // Decided PER VALUE, the same rule as `tariff-row` — a blanket minimum of 0
  // renders £74.50 as "£74.5".
  const money = (v: number) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
  const net = estimatedSaving !== undefined && exitFee !== undefined ? estimatedSaving - exitFee : undefined;
  return (
    <div data-slot="switch-supplier" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">
          {from ? `${from} ` : ""}<span aria-hidden="true">→</span> {to}
        </span>
        {tariff && <span className="block text-xs text-muted-foreground">{tariff}</span>}
      </p>
      {estimatedSaving !== undefined && (
        <p className="text-xs tabular-nums">
          About {money(estimatedSaving)} a year less
          {savingAt !== undefined && <span className="text-muted-foreground"> at {savingAt.toLocaleString()} {unit} a year</span>}
        </p>
      )}
      {exitFee !== undefined && exitFee > 0 && (
        <p className="text-xs tabular-nums">
          {money(exitFee)} exit fee on your current deal
          {net !== undefined && ` — ${money(net)} better off in the first year`}
        </p>
      )}
      {switchOn && <p className="text-xs text-muted-foreground">Your supply transfers on {switchOn}.</p>}
      <p className="text-xs text-muted-foreground">
        Nothing physical changes — no engineer, no interruption, the same meter.
      </p>
      <p className="text-xs text-muted-foreground">
        You can cancel within {coolingOffDays} {coolingOffDays === 1 ? "day" : "days"}. Your old supplier will send a final bill for what you used.
      </p>
    </div>
  );
}
