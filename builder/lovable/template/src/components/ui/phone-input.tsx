import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Phone } from "lucide-react";

/**
 * A phone field that behaves like one on a phone.
 *
 * `type="tel"` and `inputMode="tel"` are the whole point: they raise the numeric
 * keypad on mobile, where most of these are filled in. Deliberately NOT
 * validated or reformatted — international numbers defeat every simple rule, and
 * refusing a real number is worse than accepting an odd one.
 */
export function PhoneInput({
  value, onChange, placeholder = "07700 900123", id, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon><Phone className="size-4" /></InputGroupAddon>
      <InputGroupInput id={id} type="tel" inputMode="tel" autoComplete="tel"
        value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </InputGroup>
  );
}

/** The same without the addon, where a bare field suits the form better. */
export function PhoneField(props: React.ComponentProps<typeof Input>) {
  return <Input type="tel" inputMode="tel" autoComplete="tel" {...props} />;
}
