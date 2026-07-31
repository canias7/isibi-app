import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A bank account number, checked with the real IBAN mod-97 algorithm.
 *
 * This is the field where a typo costs actual money and the money does not come
 * back. IBAN carries two check digits precisely so a mistyped account can be
 * caught before the transfer leaves, and a form that accepts any string is
 * throwing that away — every European bank validates it, which is why the
 * standard has the check digits at all.
 *
 * mod-97 is computed in CHUNKS, not with BigInt: an IBAN is up to 34 characters
 * and expands to over 40 digits, well past what a JavaScript number holds. The
 * classic remainder-carrying loop is exact at any length and needs nothing
 * beyond `Number`.
 *
 * Grouped in fours for reading and checking against a bank statement, which is
 * how the standard prints it. Upper-cased on the way in — IBANs are
 * case-insensitive in practice and the check maths is only defined for capitals.
 */
export function ibanValid(raw: string) {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const part = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of part) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

export function IbanInput({ value, onChange, label = "IBAN", id, hint, className }: {
  value: string;
  onChange: (raw: string) => void;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const [touched, setTouched] = React.useState(false);
  const bad = touched && value.length > 0 && !ibanValid(value);
  const shown = (value.match(/.{1,4}/g) ?? []).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      <input
        id={fieldId}
        type="text"
        value={shown}
        onChange={(e) => onChange(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 34))}
        onBlur={() => setTouched(true)}
        spellCheck={false}
        autoComplete="off"
        placeholder="GB29 NWBK 6016 1331 9268 19"
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
        className={cn("h-9 w-full rounded-md border bg-background px-3 font-mono text-sm outline-none",
          bad ? "border-foreground" : "border-border focus-visible:border-ring")}
      />
      {bad ? (
        <p id={`${fieldId}-err`} role="alert" className="text-xs font-medium">
          That is not a valid IBAN — the check digits do not match, so a character is wrong.
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
