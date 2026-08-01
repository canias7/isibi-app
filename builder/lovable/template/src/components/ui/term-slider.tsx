import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Choosing a term, with both consequences moving at once.
 *
 * THE TOTAL COST MOVES ON SCREEN AS THE TERM MOVES. A slider that only changes
 * the monthly payment teaches the borrower that a longer term is better, because
 * on that display it always is. Showing both numbers respond to the same drag is
 * the entire reason this is a component rather than an input.
 *
 * THE STEP IS A YEAR, NOT A MONTH. Nobody chooses between 23 and 24 years, and a
 * 360-position slider makes the useful range unreachable with a thumb.
 *
 * IT SHOWS WHAT AGE THE TERM ENDS AT WHEN IT KNOWS. A 30-year term taken at 48
 * runs past most people's retirement, and lenders decline it for that reason —
 * far better learnt while moving the slider than in a rejection letter.
 *
 * A REAL RANGE INPUT, so arrow keys work and it is reachable without a mouse.
 * The custom-drawn track everybody builds for this is the classic unusable one.
 */
export function TermSlider({ years, onChange, min = 5, max = 40, principal, annualRatePercent, ageNow, currency = "GBP", locale = "en-GB", className }: {
  years: number;
  onChange?: (y: number) => void;
  min?: number;
  max?: number;
  /** Given both, the cost of the choice is shown as it moves. */
  principal?: number;
  annualRatePercent?: number;
  /** Given, the age the term ends at is shown. */
  ageNow?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const id = useId();
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  let payment: number | undefined;
  let total: number | undefined;
  if (principal !== undefined && annualRatePercent !== undefined) {
    const n = Math.max(1, Math.round(years * 12));
    const r = annualRatePercent / 100 / 12;
    payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
    total = payment * n;
  }
  const endsAt = ageNow !== undefined ? ageNow + years : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        Over {years} {years === 1 ? "year" : "years"}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={years}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-full accent-foreground"
      />
      {payment !== undefined && total !== undefined && (
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm tabular-nums">
          <p>
            <span className="block text-xs text-muted-foreground">Each month</span>
            <span className="font-medium">{money(payment)}</span>
          </p>
          <p>
            <span className="block text-xs text-muted-foreground">Paid in total</span>
            <span className="font-medium">{money(total)}</span>
          </p>
        </div>
      )}
      {endsAt !== undefined && (
        <p className={cn("text-xs tabular-nums", endsAt >= 70 ? "font-medium" : "text-muted-foreground")}>
          Finishes when you are {endsAt}
          {endsAt >= 70 ? " — past the age most lenders will run a term to." : "."}
        </p>
      )}
    </div>
  );
}
