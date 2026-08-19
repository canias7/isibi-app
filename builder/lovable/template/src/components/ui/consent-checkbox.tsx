import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * "I agree to the terms."
 *
 * Never pre-ticked, and the prop to do so does not exist. A pre-ticked
 * consent box is not consent — it is unenforceable in most of the places a
 * generated site's customers live, and regulators fine people for it.
 *
 * The links sit INSIDE the label and open in a new tab, so reading the terms
 * does not throw away the half-filled form underneath.
 */
export function ConsentCheckbox({ checked, onCheckedChange, id = "consent", children, error, className }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; id?: string;
  children?: React.ReactNode; error?: string | null; className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox id={id} checked={checked} className="mt-0.5"
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
          onCheckedChange={(v) => onCheckedChange(v === true)} />
        <label htmlFor={id} className="text-sm leading-snug [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </label>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="ps-7 text-sm text-destructive">{error}</p>}
    </div>
  );
}
