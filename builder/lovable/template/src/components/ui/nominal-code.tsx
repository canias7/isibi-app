import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Picking the account a cost is posted to — with what it changes.
 *
 * THE CONSEQUENCE OF THE CHOICE IS SHOWN, not just the name. Whether something
 * is an expense or an asset, whether the sales tax is recoverable, whether it
 * is disallowable for tax — the person coding an invoice is making all three
 * decisions and is usually shown only a dropdown of names.
 *
 * THE COMMON ONES COME FIRST AND THE LIST IS SEARCHABLE BY CODE OR NAME.
 * Somebody coding forty invoices knows "7500"; somebody coding their first
 * knows "postage". Both have to work.
 *
 * A DISALLOWABLE ACCOUNT IS MARKED AT THE POINT OF CHOOSING. Entertaining and
 * some motor costs are not deductible, and the correction otherwise happens at
 * year end when nobody remembers what the invoice was for.
 *
 * IT IS A REAL `<select>` WITH A REAL LABEL. This is a form field on a screen
 * people use all day, and a custom dropdown is slower for exactly them.
 */
export type NominalOption = {
  code: string;
  name: string;
  /** "Expense", "Fixed asset". */
  treatment?: string;
  taxRecoverable?: boolean;
  disallowable?: boolean;
};

export function NominalCode({ label = "Post to", options, value, onChange, className }: {
  label?: string;
  options: NominalOption[];
  value?: string;
  onChange?: (next: string) => void;
  className?: string;
}) {
  // Generated, not hardcoded: two of these on one form would otherwise share an
  // id and the second label would focus the first control.
  const id = useId();
  const chosen = options.find((o) => o.code === value);
  return (
    <div data-slot="nominal-code" className={cn("space-y-1", className)}>
      <label className="block text-sm font-medium" htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      >
        <option value="">Choose an account</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>{o.code} — {o.name}</option>
        ))}
      </select>
      {chosen && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {chosen.treatment ?? "Treatment not recorded"}
            {chosen.taxRecoverable !== undefined &&
              (chosen.taxRecoverable ? " · sales tax recoverable" : " · sales tax not recoverable")}
          </p>
          {chosen.disallowable && (
            <p className="text-xs font-medium">
              Not deductible for tax — it will be added back at the year end.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
