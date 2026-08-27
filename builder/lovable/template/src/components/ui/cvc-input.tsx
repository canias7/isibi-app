import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The security code beside a card number.
 *
 * Its LENGTH comes from the card, not from a constant. Amex is four digits on
 * the front; everything else is three on the back — a field hard-coded to three
 * silently truncates every Amex code and the payment is declined for a reason
 * nobody can see. `cardBrand(digits).cvc` supplies it.
 *
 * The hint says WHERE the number is, and changes with the brand for the same
 * reason. "The three digits on the back" is wrong advice on an Amex, and
 * somebody turning the card over and finding nothing concludes their card is
 * the problem.
 *
 * `type="text"` with `inputMode="numeric"`, never `type="number"`: a number
 * input drops a leading zero, offers a spinner nobody wants on a security code,
 * and scroll-wheels the value while the page is being scrolled.
 */
export function CvcInput({ value, onChange, length = 3, label = "Security code", id, className }: {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  label?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <div data-slot="cvc-input" className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      <input
        id={fieldId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        inputMode="numeric"
        autoComplete="cc-csc"
        maxLength={length}
        placeholder={"•".repeat(length)}
        aria-describedby={`${fieldId}-hint`}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm tracking-widest tabular-nums outline-none focus-visible:border-ring"
      />
      <p id={`${fieldId}-hint`} className="flex items-center gap-1 text-xs text-muted-foreground">
        <HelpCircle aria-hidden className="size-3" />
        {length === 4 ? "Four digits on the FRONT of the card." : "Three digits on the back, beside the signature."}
      </p>
    </div>
  );
}
