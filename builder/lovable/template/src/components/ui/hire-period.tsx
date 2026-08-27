import { cn } from "@/lib/utils";
/**
 * How long something is out for, and what that actually costs.
 *
 * THE CHARGING PERIOD IS NOT THE CALENDAR AND THE COMPONENT SHOWS BOTH. Hire is
 * usually billed in whole days, weeks or weekends, so eight days often costs the
 * same as a fortnight and four hours costs a day. The customer who learns this
 * at the counter feels overcharged; the one who learns it here chooses a
 * different return day.
 *
 * IT NAMES THE CHEAPER OPTION WHEN THERE IS ONE. If keeping it two more days
 * costs nothing because the week rate has already applied, saying so is worth
 * more than the two days' revenue and costs nothing to say.
 *
 * THE TOTAL IS COMPUTED FROM THE PERIODS AND THE RATE. A quoted total that does
 * not follow from the rate card is the argument this component prevents.
 *
 * NO PRORATA. Hire is not billed by the hour in most trades, and pretending it
 * is produces a figure the invoice will not match.
 */
export function HirePeriod({ days, dayRate, weekRate, weekendRate, out, back, currency = "GBP", locale = "en-GB", className }: {
  days: number;
  dayRate: number;
  /** Where a week costs less than seven days. */
  weekRate?: number;
  weekendRate?: number;
  out?: string;
  back?: string;
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
  // Computed from the rate card so the quote and the invoice cannot disagree.
  const weeks = weekRate !== undefined ? Math.floor(days / 7) : 0;
  const spare = days - weeks * 7;
  const sparePriced = weekRate !== undefined && spare * dayRate > weekRate ? weekRate : spare * dayRate;
  const total = weeks * (weekRate ?? 0) + sparePriced;
  const roundsUpToWeek = weekRate !== undefined && spare > 0 && spare * dayRate >= weekRate;
  const freeDays = roundsUpToWeek ? 7 - spare : 0;
  return (
    <div data-slot="hire-period" className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="text-lg font-medium">{money(total)}</span>
        <span className="text-muted-foreground">
          {" "}
          · {days} {days === 1 ? "day" : "days"}
          {out || back ? ` · ${[out, back].filter(Boolean).join(" to ")}` : ""}
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {money(dayRate)} a day
        {weekRate !== undefined ? `, ${money(weekRate)} a week` : ""}
        {weekendRate !== undefined ? `, ${money(weekendRate)} for a weekend` : ""}.
      </p>
      {roundsUpToWeek && freeDays > 0 && (
        <p className="text-xs font-medium tabular-nums">
          This is already charged as a full week, so you can keep it {freeDays} more{" "}
          {freeDays === 1 ? "day" : "days"} for nothing.
        </p>
      )}
    </div>
  );
}
