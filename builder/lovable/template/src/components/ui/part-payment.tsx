import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Pay some of it now.
 *
 * THE REMAINING BALANCE UPDATES AS YOU TYPE. Entering an amount without seeing
 * what is left means doing the subtraction in your head against a number
 * somewhere else on the page, which is where the wrong figure gets entered.
 *
 * OVERPAYMENT IS REFUSED WITH THE NUMBER NAMED — "more than the £240 owed" —
 * rather than silently clamped. Clamping is worse: the reader sees a figure they
 * did not type and cannot tell whether it was corrected or ignored.
 *
 * `inputMode="decimal"`, never `numeric`: a numeric keypad has no decimal point,
 * so £47.50 cannot be typed at all. Same lesson `currency-input` records.
 */
export function PartPayment({ owed, value, onChange, onPay, currency = "GBP", busy, id, className }: {
  owed: number;
  value: number | null;
  onChange: (v: number | null) => void;
  onPay: () => void;
  currency?: string;
  busy?: boolean;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const paying = value ?? 0;
  const over = paying > owed;
  const left = Math.max(owed - paying, 0);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium">How much would you like to pay?</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={fieldId} type="number" inputMode="decimal" step="0.01" min={0} value={value ?? ""}
          aria-invalid={over || undefined}
          aria-describedby={`${fieldId}-note`}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-9 w-32 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
        <BusyButton size="sm" busy={busy} disabled={over || paying <= 0} onClick={onPay}>Pay</BusyButton>
      </div>
      <p id={`${fieldId}-note`} role="status" className={cn("text-xs tabular-nums", over ? "font-medium" : "text-muted-foreground")}>
        {over
          ? <>That&apos;s more than the <Money amount={owed} currency={currency} /> owed.</>
          : <><Money amount={left} currency={currency} /> would be left.</>}
      </p>
    </div>
  );
}
