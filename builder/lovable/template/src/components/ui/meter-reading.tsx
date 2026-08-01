import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Submitting a reading — with the checks that stop a wrong one being billed.
 *
 * A READING LOWER THAN THE LAST ONE IS QUERIED, NOT REJECTED. Meters do roll
 * over, and get replaced, and both produce a legitimately lower number — but
 * the overwhelming cause is a typo, and billing it produces a credit note and
 * a phone call. So it asks rather than refusing.
 *
 * AN IMPLAUSIBLE JUMP IS QUERIED THE SAME WAY. A digit added by accident bills
 * somebody ten times their usual amount, which is the error that ends up in the
 * newspaper, and it is caught by comparing against their own history rather
 * than against any absolute rule.
 *
 * DECIMALS ARE REFUSED WHERE THE METER HAS NONE. The red dial is not part of
 * the reading and entering it inflates the bill by a factor of ten.
 *
 * A DECIMAL SUPPRESSES THE OTHER TWO CHECKS, and this is the bug worth naming.
 * Stripping non-digits from "04120.4" gives 041204 — it SPLICES the red dial
 * into the number rather than dropping it — so the value then compares as lower
 * than the last reading and a second warning fires. Two messages where one is an
 * artefact of misreading the other is how somebody concludes the form is broken
 * and rings instead.
 *
 * `inputMode="numeric"` AND NO SPINNER. This is typed off a dial on a phone in
 * a cupboard, and a numeric keypad is most of what makes that possible.
 */
export function MeterReading({ label = "Meter reading", digits = 5, previous, previousOn, typicalDailyUse, value, onChange, className }: {
  label?: string;
  /** How many digits the meter shows, black dials only. */
  digits?: number;
  /** The last reading taken. */
  previous?: number;
  /** Free text — "14 July". */
  previousOn?: string;
  /** Their own normal daily consumption, for the plausibility check. */
  typicalDailyUse?: number;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const hadDecimal = /[.,]/.test(value);
  const clean = value.split(/[.,]/)[0].replace(/[^\d]/g, "");
  const n = clean === "" ? undefined : Number(clean);
  const lower = !hadDecimal && n !== undefined && previous !== undefined && n < previous;
  const jump = !hadDecimal && n !== undefined && previous !== undefined && typicalDailyUse
    ? n - previous > typicalDailyUse * 365
    : false;
  const query = touched && (lower || jump || hadDecimal);
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        maxLength={digits + 2}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-describedby={`${id}-help`}
        aria-invalid={query ? true : undefined}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        The {digits} black digits only — leave out anything in red.
        {previous !== undefined && ` Last reading ${previous}${previousOn ? ` on ${previousOn}` : ""}.`}
      </p>
      {touched && hadDecimal && (
        <p className="text-xs font-medium">That looks like it includes the red dial — enter whole numbers only.</p>
      )}
      {touched && lower && (
        <p className="text-xs font-medium">
          That is lower than the last reading. Check the digits — or tell us if the meter has been changed.
        </p>
      )}
      {touched && jump && (
        <p className="text-xs font-medium">
          That is far higher than your usual usage. Check for an extra digit before submitting.
        </p>
      )}
    </div>
  );
}
