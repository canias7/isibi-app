import { cn } from "@/lib/utils";
/**
 * Data used against data left, with the rate of use projected.
 *
 * THE PROJECTION IS WHAT MAKES THIS USEFUL. "6 GB of 20 GB used" is
 * unactionable on its own; "at this rate you run out on the 22nd, six days
 * early" is something somebody can do something about. It is computed from days
 * elapsed rather than accepted from the caller.
 *
 * WHAT HAPPENS AT ZERO IS STATED AND IT IS NOT THE SAME EVERYWHERE. Cut off,
 * slowed, or charged per gigabyte are three very different outcomes, and the
 * third is the one that produces a frightening bill. Somebody near their limit
 * needs to know which before they reach it.
 *
 * A BAR IS PAIRED WITH THE NUMBERS, NEVER ALONE. A bar answers "roughly how far
 * through" at a glance and cannot answer "how much is left", and half the people
 * looking at this want the second.
 *
 * UNLIMITED SAYS WHETHER IT REALLY IS. Most unlimited plans slow down past some
 * threshold, and a component that renders "Unlimited" and stops is repeating the
 * marketing.
 */
export function DataAllowance({ usedGb, allowanceGb, daysElapsed, daysInPeriod, atLimit = "slowed", perGbCharge, fairUseGb, currency = "GBP", locale = "en-GB", className }: {
  usedGb: number;
  /** Undefined means unlimited. */
  allowanceGb?: number;
  daysElapsed?: number;
  daysInPeriod?: number;
  /** Three very different outcomes. */
  atLimit?: "cut off" | "slowed" | "charged";
  perGbCharge?: number;
  /** Where an "unlimited" plan actually slows. */
  fairUseGb?: number;
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
  const gb = (n: number) => `${Number(n.toFixed(1))} GB`;
  if (allowanceGb === undefined) {
    return (
      <div className={cn("space-y-0.5 text-sm", className)}>
        <p className="tabular-nums">
          <span className="font-medium">{gb(usedGb)} used</span>
          <span className="text-muted-foreground"> · unlimited</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {fairUseGb !== undefined
            ? `Unlimited, but it slows down past ${gb(fairUseGb)} in a month.`
            : "No stated point at which it slows down."}
        </p>
      </div>
    );
  }
  const pct = allowanceGb > 0 ? Math.min(100, (usedGb / allowanceGb) * 100) : 0;
  const left = Math.max(0, allowanceGb - usedGb);
  // Projected from the rate so far, which is what makes the number actionable.
  let runsOutOnDay: number | undefined;
  if (daysElapsed && daysInPeriod && usedGb > 0) {
    const perDay = usedGb / daysElapsed;
    const daysToZero = left / perDay;
    const day = Math.floor(daysElapsed + daysToZero);
    if (day < daysInPeriod) runsOutOnDay = day;
  }
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{gb(left)} left</span>
        <span className="text-muted-foreground">
          {" "}
          · {gb(usedGb)} of {gb(allowanceGb)} used
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      {runsOutOnDay !== undefined && daysInPeriod !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          At this rate it runs out around day {runsOutOnDay} of {daysInPeriod} — {daysInPeriod - runsOutOnDay}{" "}
          {daysInPeriod - runsOutOnDay === 1 ? "day" : "days"} early.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {atLimit === "cut off"
          ? "At zero the data stops until the period resets."
          : atLimit === "slowed"
            ? "At zero it keeps working but slows down. Nothing extra is charged."
            : `At zero you are charged${perGbCharge !== undefined ? ` ${money(perGbCharge)} a gigabyte` : " per gigabyte"} — this is the one that produces a large bill.`}
      </p>
    </div>
  );
}
