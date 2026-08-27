import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * MM / YY, as one field.
 *
 * ONE field, not two selects. Two dropdowns is the common pattern and it is
 * four interactions to enter four characters that are printed on the card in
 * exactly this form; typing "0429" is one. The slash is inserted, never typed.
 *
 * A card expires at the END of its month, so December 2026 is valid for the
 * whole of December 2026 — comparing against today's date rather than the end
 * of that month rejects a perfectly good card for up to thirty days.
 *
 * Two digits of year means the CENTURY has to be assumed, and assuming 2000s
 * outright breaks in 2100. It resolves to the current century and rolls forward
 * if that would already be in the past, which is what every payment form does
 * and is correct for anything with a horizon under a hundred years.
 *
 * The message only appears once four digits are in and the field is blurred:
 * "0" is not an expired card, it is somebody who has typed one character.
 */
export function expiryState(value: string, now = new Date()) {
  const mm = Number(value.slice(0, 2)), yy = value.slice(2, 4);
  if (value.length < 4) return "incomplete" as const;
  if (!(mm >= 1 && mm <= 12)) return "bad-month" as const;
  const century = Math.floor(now.getFullYear() / 100) * 100;
  let year = century + Number(yy);
  if (year < now.getFullYear()) year += 100;
  const endOfMonth = new Date(year, mm, 1).getTime() - 1;
  return endOfMonth < now.getTime() ? ("expired" as const) : ("ok" as const);
}

export function ExpiryInput({ value, onChange, label = "Expiry", id, className }: {
  value: string;
  onChange: (digits: string) => void;
  label?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const [touched, setTouched] = React.useState(false);
  const state = expiryState(value);
  const bad = touched && (state === "expired" || state === "bad-month");
  const shown = value.length > 2 ? `${value.slice(0, 2)} / ${value.slice(2)}` : value;

  return (
    <div data-slot="expiry-input" className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      <input
        id={fieldId}
        type="text"
        value={shown}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={() => setTouched(true)}
        inputMode="numeric"
        autoComplete="cc-exp"
        placeholder="MM / YY"
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${fieldId}-err` : undefined}
        className={cn("h-9 w-full rounded-md border bg-background px-3 text-sm tabular-nums outline-none",
          bad ? "border-foreground" : "border-border focus-visible:border-ring")}
      />
      {bad ? (
        <p id={`${fieldId}-err`} role="alert" className="text-xs font-medium">
          {state === "bad-month" ? "The month has to be 01 to 12." : "That card has expired."}
        </p>
      ) : null}
    </div>
  );
}
