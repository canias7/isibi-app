import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * A postal code.
 *
 * Uppercased on the way in and nothing else. Deliberately NOT validated: the
 * formats differ by country, several are still being added to, and refusing a
 * real address because a regex has not heard of it is worse than accepting an
 * odd one — the same call `phone-input` makes.
 *
 * `autoComplete="postal-code"` is the whole reason this exists as its own
 * component: without it a browser cannot fill an address block in one tap.
 */
export function PostcodeInput({ value, onChange, id, placeholder = "Postcode", className }: {
  value: string; onChange: (v: string) => void; id?: string;
  placeholder?: string; className?: string;
}) {
  return (
    <Input id={id} value={value} placeholder={placeholder}
      autoComplete="postal-code" autoCapitalize="characters" spellCheck={false}
      className={cn("uppercase", className)}
      onChange={(e) => onChange(e.target.value.toUpperCase())} />
  );
}
