import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Prices shown in another currency — clearly marked as approximate.
 *
 * THE CHARGED CURRENCY IS THE TRUTH AND SAYS SO. A shop charges in one
 * currency; a viewer paying by card gets their bank's rate on the day, not
 * ours. So the converted figure is "about €33", the charged price stays
 * visible, and the rate's DATE is printed — an unlabelled conversion is a
 * price promise the shop cannot keep, which is a complaint and sometimes a
 * legal one.
 *
 * RATES ARE DATA, NOT ARITHMETIC. They arrive as a prop with a timestamp;
 * nothing here fetches or invents one. That is the same line `unit-convert`
 * draws — a conversion factor that changes daily is not a constant.
 *
 * Formatting goes through `Intl.NumberFormat` with the currency code, so the
 * symbol lands on the correct side with the right separators — €1.234,56 and
 * £1,234.56 are both right and both unreachable by string concatenation.
 */
export function CurrencySwitch({ amount, currency, show, rate, rateDate, className }: {
  amount: number;
  currency: string;
  show?: string;
  rate?: number;
  rateDate?: React.ReactNode;
  className?: string;
}) {
  const fmt = (n: number, c: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);
    } catch {
      return `${n.toLocaleString()} ${c}`;
    }
  };
  const charged = fmt(amount, currency);
  const converting = show && show !== currency && rate != null;

  if (!converting) {
    return <span data-slot="currency-switch" className={cn("tabular-nums", className)}>{charged}</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5 tabular-nums", className)}>
      <span>about {fmt(amount * rate, show)}</span>
      {/* The charged price is the truth and stays visible. */}
      <span className="text-xs text-muted-foreground">
        charged as {charged}
        {rateDate ? <> · rate from {rateDate}</> : null}
      </span>
    </span>
  );
}
