import { Input } from "@/components/ui/input";
import { FormRow } from "@/components/ui/form-row";
import { cn } from "@/lib/utils";
export type Address = { line1: string; line2?: string; city: string; postcode: string; country?: string };
/**
 * A postal address.
 *
 * Every field carries the right `autoComplete` token, which is what lets a
 * browser fill the whole block in one tap — the main reason to have this rather
 * than five loose inputs.
 */
export function AddressFields({ value, onChange, className }: {
  value: Address; onChange: (next: Address) => void; className?: string;
}) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div data-slot="address-fields" className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <FormRow label="Address" className="sm:col-span-2">
        <Input autoComplete="address-line1" value={value.line1} onChange={set("line1")} />
      </FormRow>
      <FormRow label="Address line 2" className="sm:col-span-2">
        <Input autoComplete="address-line2" value={value.line2 ?? ""} onChange={set("line2")} />
      </FormRow>
      <FormRow label="Town or city">
        <Input autoComplete="address-level2" value={value.city} onChange={set("city")} />
      </FormRow>
      <FormRow label="Postcode">
        <Input autoComplete="postal-code" autoCapitalize="characters"
          value={value.postcode} onChange={set("postcode")} />
      </FormRow>
    </div>
  );
}
