import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
/**
 * Money.
 *
 * `inputMode="decimal"` rather than `numeric`, so a phone keypad offers a decimal
 * point — a numeric keypad cannot type 4.50. The symbol is an addon rather than
 * part of the value, so what is submitted stays a plain number.
 */
export function CurrencyInput({ value, onChange, symbol = "£", id, placeholder = "0.00", className }: {
  value: string; onChange: (v: string) => void; symbol?: string;
  id?: string; placeholder?: string; className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon><span className="text-sm text-muted-foreground">{symbol}</span></InputGroupAddon>
      <InputGroupInput id={id} inputMode="decimal" value={value} placeholder={placeholder}
        className="tabular-nums"
        onChange={(e) => { const v = e.target.value; if (/^\d*[.,]?\d{0,2}$/.test(v)) onChange(v.replace(",", ".")); }} />
    </InputGroup>
  );
}
