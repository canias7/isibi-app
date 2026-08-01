import { cn } from "@/lib/utils";
/**
 * What was billed on an estimate, against what the meter actually says.
 *
 * IT NAMES WHICH WAY THE CORRECTION GOES IN WORDS. "Difference: 412" tells
 * somebody nothing about whether money is owed or coming back, which is the one
 * thing they want to know, and it is the sentence that decides whether they
 * ring.
 *
 * IT EXPLAINS WHY THE NEXT BILL LOOKS WRONG. A year of low estimates corrected
 * in one bill is a single enormous charge for usage spread over twelve months,
 * and without that sentence it reads as an error or an overcharge.
 *
 * THE PERIOD IS SHOWN, because the size of a correction is only judgeable
 * against how long it accumulated. A £300 catch-up over two years is ordinary;
 * over one month it is a fault.
 *
 * IT SEPARATES THE UNITS FROM THE MONEY. Consumption was mis-estimated in units;
 * the cash depends on rates that may have changed mid-period, so showing only
 * money makes the correction impossible to check.
 */
export function EstimatedVsActual({ periodLabel, estimatedUnits, actualUnits, unit = "kWh", amount, currency = "GBP", locale = "en-GB", spreadOffered, className }: {
  /** Free text — "August 2025 to July 2026". */
  periodLabel?: string;
  estimatedUnits: number;
  actualUnits: number;
  unit?: string;
  /** The correction in money, in major units. Positive means owed. */
  amount?: number;
  currency?: string;
  locale?: string;
  /** True where the customer can pay it over time. */
  spreadOffered?: boolean;
  className?: string;
}) {
  const diff = actualUnits - estimatedUnits;
  const owes = diff > 0;
  const money = amount !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(Math.abs(amount))
    : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(diff !== 0 && "font-medium")}>
        {diff === 0
          ? "The estimates were right — nothing to correct."
          : owes
            ? `You used more than we estimated${money ? ` — ${money} to pay` : ""}.`
            : `You used less than we estimated${money ? ` — ${money} back to you` : ""}.`}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {estimatedUnits.toLocaleString()} {unit} estimated · {actualUnits.toLocaleString()} {unit} actually used
        {diff !== 0 && ` · ${Math.abs(diff).toLocaleString()} ${unit} ${owes ? "more" : "less"}`}
      </p>
      {periodLabel && <p className="text-xs text-muted-foreground">{periodLabel}</p>}
      {diff !== 0 && (
        <p className="text-xs text-muted-foreground">
          This is {owes ? "usage you have already had" : "money you have already paid"}, spread over the whole period —
          not a change in what you use now.
        </p>
      )}
      {owes && spreadOffered && (
        <p className="text-xs">You can pay this over several months instead of in one go.</p>
      )}
    </div>
  );
}
