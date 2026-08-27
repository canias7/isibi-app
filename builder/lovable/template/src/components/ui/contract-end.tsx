import { cn } from "@/lib/utils";
/**
 * When a contract ends — and what it silently becomes afterwards.
 *
 * WHAT HAPPENS AFTER THE END DATE IS THE POINT. A contract that rolls onto a
 * higher monthly price is the normal arrangement, and the money lost to it is
 * lost by people who simply did not know the date had passed. The component
 * states the rolling price beside the end date, not on another page.
 *
 * OUT OF CONTRACT IS A GOOD STATE AND IS SAID SO. Being free to leave is
 * leverage, and providers present it as an alarming lapse. Here it reads as what
 * it is: no penalty, negotiable, cancellable.
 *
 * THE EXIT FEE IS SHOWN WHILE STILL IN CONTRACT, as an amount. "Early
 * termination charges may apply" is the phrase that stops people finding out
 * whether leaving is actually cheaper.
 *
 * NO RENEWAL COUNTDOWN PRESSURE. The date is stated once, plainly, without a
 * ticking clock or a "reserve your price" button, because those exist to make
 * somebody decide before they have compared anything.
 */
export function ContractEnd({ endsOn, daysLeft, currentPrice, rollingPrice, exitFee, currency = "GBP", locale = "en-GB", className }: {
  endsOn?: string;
  /** Negative or zero means out of contract. */
  daysLeft?: number;
  currentPrice?: number;
  /** What it becomes afterwards, unless somebody acts. */
  rollingPrice?: number;
  /** As an amount, not as "charges may apply". */
  exitFee?: number;
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
  const out = daysLeft !== undefined && daysLeft <= 0;
  const rise =
    currentPrice !== undefined && rollingPrice !== undefined ? rollingPrice - currentPrice : undefined;
  return (
    <div data-slot="contract-end" className={cn("space-y-0.5 text-sm", className)}>
      {out ? (
        <p className="font-medium">
          You are out of contract. You can leave, switch or renegotiate at any time with nothing to pay.
        </p>
      ) : (
        <p className="tabular-nums">
          <span className="font-medium">
            {daysLeft !== undefined ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : "Still in contract"}
          </span>
          {endsOn && <span className="text-muted-foreground"> · ends {endsOn}</span>}
        </p>
      )}
      {rollingPrice !== undefined && (
        <p className={cn("text-xs tabular-nums", rise !== undefined && rise > 0 ? "font-medium" : "text-muted-foreground")}>
          {out ? "You are now paying" : "After that it becomes"} {money(rollingPrice)} a month
          {rise !== undefined && rise > 0
            ? ` — ${money(rise)} more than now, unless somebody changes it`
            : ""}
          .
        </p>
      )}
      {!out && exitFee !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Leaving early costs {money(exitFee)}. Worth comparing against what a year elsewhere would save.
        </p>
      )}
    </div>
  );
}
