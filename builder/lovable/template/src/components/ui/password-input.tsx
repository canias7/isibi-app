import * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Eye, EyeOff } from "lucide-react";
/**
 * A password field that can be read back.
 *
 * Hiding a password from the person typing it causes far more failed sign-ins
 * than it prevents shoulder-surfing. `autoComplete` is passed through so a
 * manager knows whether this is a new password or an existing one.
 */
export function PasswordInput({ value, onChange, id, autoComplete = "current-password", placeholder, className }: {
  value: string; onChange: (v: string) => void; id?: string;
  autoComplete?: "current-password" | "new-password"; placeholder?: string; className?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <InputGroup className={className}>
      <InputGroupInput id={id} type={show ? "text" : "password"} value={value}
        autoComplete={autoComplete} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <InputGroupAddon align="inline-end">
        <button type="button" aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow(!show)} className="cursor-pointer text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </InputGroupAddon>
    </InputGroup>
  );
}
