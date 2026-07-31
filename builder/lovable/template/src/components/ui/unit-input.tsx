import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A number and the unit it is in — 30 minutes, 2 kg, 500 ml.
 *
 * The unit is a separate value, never parsed out of the text. "2.5 hrs" typed
 * into a single box is a string somebody's regex has to guess at, and the
 * guess is wrong for every locale that writes a decimal comma.
 */
export function UnitInput({ value, unit, units, onValueChange, onUnitChange, id, placeholder, className }: {
  value: string; unit: string; units: { value: string; label: string }[];
  onValueChange: (v: string) => void; onUnitChange: (u: string) => void;
  id?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={cn("flex", className)}>
      <Input id={id} inputMode="decimal" value={value} placeholder={placeholder}
        className="rounded-r-none tabular-nums"
        onChange={(e) => onValueChange(e.target.value.replace(/[^0-9.,]/g, ""))} />
      <NativeSelect value={unit} onChange={(e) => onUnitChange(e.target.value)}
        aria-label="Unit" className="w-auto rounded-l-none border-l-0">
        {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </NativeSelect>
    </div>
  );
}
