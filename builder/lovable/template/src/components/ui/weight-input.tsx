import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A weight, with a precision that suits the unit.
 *
 * THE DETAIL THAT MATTERS: grams and ounces are whole numbers in practice,
 * kilograms and pounds are not. Converting 500 g to kg and printing
 * 0.5000000000000001 is the sort of thing that makes an otherwise fine form
 * look broken, and rounding everything to the same number of places makes
 * either the small units useless or the large ones absurd. Each unit carries
 * its own sensible precision.
 *
 * Stones are offered because bodyweight is quoted in them in several countries
 * and a field without them sends people to a converter mid-form — but they are
 * not a default, since almost nothing else uses them.
 *
 * `min={0}`, because a negative weight is not a thing anybody means to type,
 * unlike a temperature.
 */
const PER_KG: Record<string, number> = {
  "g": 1000, "kg": 1, "lb": 2.204623, "oz": 35.27396, "st": 0.157473, "t": 0.001,
};
const PLACES: Record<string, number> = { g: 0, kg: 2, lb: 2, oz: 1, st: 2, t: 3 };

/** Convert a weight between the units this field offers. */
export function convertWeight(value: number, from: string, to: string): number | null {
  const a = PER_KG[from], b = PER_KG[to];
  if (!a || !b) return null;
  return (value / a) * b;
}

export function WeightInput({ value, unit, onChange, units = ["g", "kg", "lb", "oz"], id, className }: {
  value: number | null;
  unit: string;
  onChange: (next: { value: number | null; unit: string }) => void;
  units?: string[];
  id?: string;
  className?: string;
}) {
  return (
    <span data-slot="weight-input" className={cn("inline-flex items-stretch gap-1.5", className)}>
      <input id={id} type="number" inputMode="decimal" step="any" min={0} value={value ?? ""}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value), unit })}
        className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <NativeSelect value={unit} aria-label="Weight unit" className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = e.target.value;
          const c = value === null ? null : convertWeight(value, unit, next);
          onChange({
            value: c === null ? value : Number(c.toFixed(PLACES[next] ?? 2)),
            unit: next,
          });
        }}>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </NativeSelect>
    </span>
  );
}
