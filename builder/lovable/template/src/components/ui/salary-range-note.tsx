import { cn } from "@/lib/utils";
/**
 * The published range — and where in it an offer would realistically land.
 *
 * THE REALISTIC POINT MATTERS MORE THAN THE TOP OF THE RANGE. Advertising
 * £40,000–£60,000 while every hire lands at £43,000 is technically true and
 * wastes everybody's time, and the honest version is what stops a candidate
 * declining at the end over a number they were shown at the start.
 *
 * WHAT MOVES SOMEBODY UP THE RANGE IS STATED. If the top is reserved for a
 * qualification or a language, saying so is a fair filter; leaving it unsaid
 * turns the range into a lottery in which the confident negotiators win.
 *
 * IT NEVER ASKS FOR SALARY EXPECTATIONS. Anchoring on the candidate's number
 * transfers whatever pay gap they arrived with, and the range is the employer's
 * to publish.
 *
 * PAY REVIEW AND PROGRESSION ARE SHOWN WHERE THEY EXIST, because "£45,000" and
 * "£45,000 with a review at six months" are different offers.
 */
export function SalaryRangeNote({ from, to, period = "a year", realisticAt, whatMovesYouUp, reviewNote, currency = "GBP", locale = "en-GB", className }: {
  from: number;
  to: number;
  period?: string;
  /** Where offers actually land. */
  realisticAt?: number;
  /** What the top of the range is reserved for. */
  whatMovesYouUp?: string;
  reviewNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const wide = from > 0 && to / from >= 1.4;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">{money(from)}–{money(to)} {period}</p>
      {realisticAt !== undefined ? (
        <p className="text-xs tabular-nums">
          Most offers for this role land around {money(realisticAt)}.
        </p>
      ) : wide ? (
        <p className="text-xs text-muted-foreground">
          That is a wide band — ask where in it this role sits before you go further.
        </p>
      ) : null}
      {whatMovesYouUp && (
        <p className="text-xs text-muted-foreground">The upper end is for {whatMovesYouUp}.</p>
      )}
      {reviewNote && <p className="text-xs text-muted-foreground">{reviewNote}</p>}
      <p className="text-xs text-muted-foreground">
        We do not ask what you earn now — the range is ours to publish, not yours to guess.
      </p>
    </div>
  );
}
