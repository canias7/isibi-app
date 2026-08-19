import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
/**
 * Pick a saved way to pay — names, last four, and honest expiry.
 *
 * NAMES, NOT BRAND LOGOS (the payment-methods refusal, kept): logos
 * need licensed artwork and ship remote images; "Visa ending 4242" is
 * the same information in system text.
 *
 * AN EXPIRED CARD IS SHOWN, DISABLED, WITH THE REASON — removing it
 * silently makes the person hunt for a card they know they saved, and
 * "expired 03/26" beside it is the answer to the question they were
 * about to ask. Disabled radios stay in the accessibility tree.
 *
 * "Add a card" is an OPTION IN THE LIST, not a separate button — the
 * moment of choosing is the moment of realising none of these work.
 */
export type PaymentMethod = { id: string; label: string; last4?: string; expires?: string; expired?: boolean };

export function PaymentPicker({ methods, value, onChange, onAdd, className }: {
  methods: PaymentMethod[];
  value?: string;
  onChange: (id: string) => void;
  onAdd?: () => void;
  className?: string;
}) {
  return (
    <RadioGroup value={value ?? ""} onValueChange={onChange} className={cn("gap-1.5", className)}>
      {methods.map((m) => (
        <label key={m.id}
          className={cn("flex items-center gap-2.5 rounded-lg border p-2.5",
            m.expired ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            value === m.id && !m.expired ? "border-foreground" : "border-border")}>
          <RadioGroupItem value={m.id} disabled={m.expired} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {m.label}{m.last4 ? <span className="font-normal text-muted-foreground"> ending {m.last4}</span> : null}
            </span>
            {m.expires ? (
              <span className={cn("block text-xs", m.expired ? "font-medium" : "text-muted-foreground")}>
                {m.expired ? `expired ${m.expires}` : `expires ${m.expires}`}
              </span>
            ) : null}
          </span>
        </label>
      ))}
      {onAdd ? (
        <button type="button" onClick={onAdd}
          className="cursor-pointer rounded-lg border border-dashed border-border p-2.5 text-start text-sm text-muted-foreground hover:border-foreground/50">
          Add a card…
        </button>
      ) : null}
    </RadioGroup>
  );
}
