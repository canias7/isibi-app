import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Standard, express, collection.
 *
 * Each option says when it ARRIVES, not how long it takes. "2–3 working days"
 * is a sum involving a calendar and a bank holiday; "arrives by Tuesday" is
 * the answer somebody is actually after, and the difference in conversion is
 * well documented.
 *
 * A real radio group, so arrow keys work.
 */
export function ShippingOptions({ name = "shipping", options, value, onChange, currency, className }: {
  name?: string;
  options: { value: string; label: string; arrives?: string; price?: number; note?: string }[];
  value?: string; onChange: (v: string) => void; currency?: string; className?: string;
}) {
  return (
    <fieldset data-slot="shipping-options" className={cn("w-full min-w-0 space-y-2", className)}>
      {options.map((o) => (
        <label key={o.value}
          className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3",
            value === o.value ? "border-foreground" : "border-border hover:bg-muted/40")}>
          <input type="radio" name={name} value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)} className="mt-1 size-4 shrink-0 accent-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{o.label}</span>
            {o.arrives && <span className="block text-sm text-muted-foreground">Arrives {o.arrives}</span>}
            {o.note && <span className="block text-xs text-muted-foreground">{o.note}</span>}
          </span>
          <span className="shrink-0 text-sm">
            {o.price == null || o.price === 0 ? "Free" : <Money amount={o.price} currency={currency} />}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
