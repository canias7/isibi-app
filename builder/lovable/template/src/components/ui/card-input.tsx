import * as React from "react";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A card number field: grouping, brand detection and a Luhn check.
 *
 * The brand is detected from the PREFIX and it changes the grouping — Amex is
 * 4-6-5, not 4-4-4-4, and a field that forces every card into groups of four
 * makes an Amex unreadable while it is being typed. It also changes the LENGTH,
 * which is what the CVC field next to it needs to know.
 *
 * `autoComplete="cc-number"` is what makes a saved card fillable in one tap,
 * and it is the single highest-value attribute on any payment form.
 *
 * Luhn is checked but only reported when the field is COMPLETE and blurred.
 * Validating on every keystroke means the message "that card number is not
 * valid" is on screen for the entire time somebody is typing a valid one.
 *
 * Nothing here talks to a payment provider — a real checkout uses the
 * provider's own hosted field so the number never touches this origin. This is
 * for the cases the provider does not cover: a saved-card display, an offline
 * terminal reference, a form the shop fills in itself.
 */
const BRANDS = [
  { name: "American Express", test: /^3[47]/, groups: [4, 6, 5], cvc: 4 },
  { name: "Visa", test: /^4/, groups: [4, 4, 4, 4], cvc: 3 },
  { name: "Mastercard", test: /^(5[1-5]|2[2-7])/, groups: [4, 4, 4, 4], cvc: 3 },
  { name: "Discover", test: /^(6011|65|64[4-9])/, groups: [4, 4, 4, 4], cvc: 3 },
  { name: "Diners Club", test: /^3(0[0-5]|[68])/, groups: [4, 6, 4], cvc: 3 },
  { name: "JCB", test: /^35/, groups: [4, 4, 4, 4], cvc: 3 },
];
const DEFAULT = { name: "", groups: [4, 4, 4, 4], cvc: 3 };

export function cardBrand(digits: string) {
  return BRANDS.find((b) => b.test.test(digits)) ?? DEFAULT;
}

export function luhn(digits: string) {
  if (digits.length < 12) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function groupCard(digits: string, groups: number[]) {
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(" ");
}

export function CardInput({ value, onChange, label = "Card number", id, className }: {
  value: string;
  onChange: (digits: string) => void;
  label?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const [touched, setTouched] = React.useState(false);
  const brand = cardBrand(value);
  const max = brand.groups.reduce((n, g) => n + g, 0);
  const complete = value.length >= max;
  const bad = touched && complete && !luhn(value);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
        {brand.name ? <span className="text-xs text-muted-foreground">{brand.name}</span> : null}
      </div>
      <div className="relative">
        <CreditCard aria-hidden className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={fieldId}
          value={groupCard(value, brand.groups)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, max))}
          onBlur={() => setTouched(true)}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder={groupCard("0".repeat(max), brand.groups).replace(/0/g, "•")}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${fieldId}-err` : undefined}
          className={cn("h-9 w-full rounded-md border bg-background pe-3 ps-8 text-sm tracking-wider tabular-nums outline-none",
            bad ? "border-foreground" : "border-border focus-visible:border-ring")}
        />
      </div>
      {bad ? (
        <p id={`${fieldId}-err`} role="alert" className="text-xs font-medium">
          Check that number — one of the digits looks wrong.
        </p>
      ) : null}
    </div>
  );
}
