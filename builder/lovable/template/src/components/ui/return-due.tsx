import { cn } from "@/lib/utils";
/**
 * When something is due back, and what being late costs.
 *
 * THE LATE CHARGE IS SHOWN BEFORE IT IS INCURRED. A hirer deciding whether to
 * drive back tonight or in the morning is making a financial decision and is
 * usually making it blind; the figure turns it into a choice.
 *
 * THE CLOSING TIME IS PART OF THE DUE DATE. "Back on Friday" and "back by 16:30
 * on Friday, when the yard shuts" are different instructions, and the gap between
 * them is a whole extra day's hire.
 *
 * IT SAYS WHETHER AN EXTENSION IS POSSIBLE AND WHO DECIDES. Somebody running
 * late will either ring or not, and a component that only threatens gets fewer
 * calls and more disputes.
 *
 * OVERDUE COUNTS IN WHOLE CHARGING PERIODS, NOT HOURS. That is how the invoice
 * will read, and showing a smaller number first makes the bill look wrong.
 */
export function ReturnDue({ dueOn, closesAt, periodsLate, latePerPeriod, periodName = "day", canExtend, extendWith, currency = "GBP", locale = "en-GB", className }: {
  dueOn?: string;
  /** Part of the deadline, not a detail. */
  closesAt?: string;
  /** Whole charging periods, the way the invoice reads. */
  periodsLate?: number;
  latePerPeriod?: number;
  periodName?: string;
  canExtend?: boolean;
  extendWith?: string;
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
  const late = periodsLate !== undefined && periodsLate > 0;
  return (
    <div data-slot="return-due" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(late ? "font-medium" : "")}>
        {late
          ? `Overdue by ${periodsLate} ${periodsLate === 1 ? periodName : `${periodName}s`}.`
          : `Back by ${closesAt ? `${closesAt} on ` : ""}${dueOn ?? "a date nobody has set"}.`}
      </p>
      {!late && closesAt && (
        <p className="text-xs text-muted-foreground">
          The yard shuts at {closesAt}. Arriving after that is another {periodName}'s hire.
        </p>
      )}
      {late && latePerPeriod !== undefined && periodsLate !== undefined && (
        <p className="text-xs tabular-nums">
          {money(latePerPeriod)} a {periodName} — {money(latePerPeriod * periodsLate)} so far.
        </p>
      )}
      {!late && latePerPeriod !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Late costs {money(latePerPeriod)} a {periodName}, charged in whole {periodName}s.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {canExtend
          ? `You can extend it${extendWith ? ` — ring ${extendWith}` : ""}. It is cheaper than being late and takes a minute.`
          : "This one cannot be extended; it is booked out to somebody else."}
      </p>
    </div>
  );
}
