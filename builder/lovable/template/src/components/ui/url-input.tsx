import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Link2 } from "lucide-react";
/**
 * A web address. Adds https:// on blur when somebody typed a bare domain, which
 * is what most people type and what most forms then reject.
 */
export function UrlInput({ value, onChange, id, placeholder = "example.com", className }: {
  value: string; onChange: (v: string) => void; id?: string; placeholder?: string; className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon><Link2 className="size-4" /></InputGroupAddon>
      <InputGroupInput id={id} type="url" inputMode="url" autoCapitalize="off" spellCheck={false}
        value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { const v = value.trim(); if (v && !/^https?:\/\//i.test(v)) onChange("https://" + v); }} />
    </InputGroup>
  );
}
