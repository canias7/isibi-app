import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Mail } from "lucide-react";
/** An email field with the right keyboard and autofill hints. */
export function EmailInput({ value, onChange, id, placeholder = "you@example.com", className }: {
  value: string; onChange: (v: string) => void; id?: string; placeholder?: string; className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon><Mail className="size-4" /></InputGroupAddon>
      <InputGroupInput id={id} type="email" inputMode="email" autoComplete="email"
        autoCapitalize="off" spellCheck={false} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </InputGroup>
  );
}
