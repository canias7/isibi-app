import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "If it is out of stock, what should we do?" — asked BEFORE picking starts.
 *
 * ASKED AT CHECKOUT, ANSWERED ONCE, HONOURED LATER. The alternative is a
 * phone call from a picker in an aisle, or a substitution nobody wanted — a
 * bag of coriander for parsley is the canonical complaint in grocery.
 *
 * THE DEFAULT IS "REFUND IT", NOT "SUBSTITUTE". A substitution is a decision
 * made on somebody's behalf about their money and their dinner; opting in is
 * the only defensible default, even though it sells less.
 *
 * PER-ITEM OVERRIDE EXISTS because the answer genuinely differs: swap the
 * milk, never swap the birthday cake.
 */
export function SubstitutionPref({ value, onChange, perItem, className }: {
  value: "refund" | "similar" | "call";
  onChange: (v: "refund" | "similar" | "call") => void;
  perItem?: React.ReactNode;
  className?: string;
}) {
  const opts = [
    { key: "refund" as const, label: "Refund it", hint: "Nothing is swapped without asking." },
    { key: "similar" as const, label: "Send something similar", hint: "The picker chooses the closest match." },
    { key: "call" as const, label: "Call me", hint: "Only if we can reach you while picking." },
  ];
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="text-sm font-medium">If something is out of stock</legend>
      {opts.map((o) => (
        <label key={o.key} className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" name="subs" checked={value === o.key} onChange={() => onChange(o.key)}
            className="mt-0.5 size-3.5 cursor-pointer accent-foreground" />
          <span>
            {o.label}
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </span>
        </label>
      ))}
      {perItem}
    </fieldset>
  );
}
