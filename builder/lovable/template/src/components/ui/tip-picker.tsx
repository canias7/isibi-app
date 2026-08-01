import * as React from "react";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Add a tip — with "no tip" as a real, equal option.
 *
 * NO TIP IS A BUTTON LIKE THE OTHERS, not a link hidden under them. A picker
 * that makes declining harder than accepting is a dark pattern, and it is the
 * commonest complaint about tipping screens.
 *
 * NOTHING IS PRESELECTED. A default tip is money taken from people who did not
 * read the screen, which is exactly the objection.
 *
 * THE CASH AMOUNT IS SHOWN UNDER EACH PERCENTAGE, because 18% of £47.50 is not a
 * number anybody computes at a till — and the percentage alone is how people
 * tip more than they meant to.
 */
export function TipPicker({ subtotal, options = [10, 12.5, 15], value, onChange, currency = "GBP", className }: {
  subtotal: number;
  /** Percentages offered. */
  options?: number[];
  /** Chosen percentage, or 0 for none, or null for undecided. */
  value: number | null;
  onChange: (pct: number | null) => void;
  currency?: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="text-sm font-medium">Add a tip</legend>
      <div role="radiogroup" aria-label="Add a tip" className="flex flex-wrap gap-2">
        {[...options, 0].map((pct) => (
          <label key={pct} htmlFor={`${id}-${pct}`}
            className={cn("flex cursor-pointer flex-col items-center rounded-md border px-3 py-2 text-sm",
              value === pct ? "border-foreground font-medium" : "border-border")}>
            <input type="radio" id={`${id}-${pct}`} name={id} className="sr-only"
              checked={value === pct} onChange={() => onChange(pct)} />
            <span>{pct === 0 ? "No tip" : `${pct}%`}</span>
            {pct > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                <Money amount={(subtotal * pct) / 100} currency={currency} />
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
