import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A temperature, where the conversion is not a factor.
 *
 * THE HAZARD: every other unit in this kit converts by multiplying. Temperature
 * does not — °F is °C × 9/5 + 32, with an OFFSET — so running it through a
 * factor table gives 0°C = 0°F, which is wrong by 32 degrees and looks like a
 * perfectly ordinary number. That single difference is why this is its own
 * component rather than a unit list handed to `unit-input`.
 *
 * NEGATIVES ARE ALLOWED, unlike every other measurement field here, which floor
 * at zero. A freezer is −18°C, and a field that refuses it is unusable for
 * exactly the businesses most likely to be recording temperatures.
 *
 * Rounded to one decimal on conversion: 20°C is 68°F, not 68.00000000000001,
 * and a temperature quoted to ten places is noise pretending to be precision.
 */
export function toF(c: number) { return c * 9 / 5 + 32; }
export function toC(f: number) { return (f - 32) * 5 / 9; }

export function TemperatureInput({ value, unit, onChange, id, className }: {
  value: number | null;
  unit: "C" | "F";
  onChange: (next: { value: number | null; unit: "C" | "F" }) => void;
  id?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-stretch gap-1.5", className)}>
      <input id={id} type="number" inputMode="decimal" step="any"
        value={value ?? ""}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value), unit })}
        className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <NativeSelect value={unit} aria-label="Temperature unit" className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = e.target.value as "C" | "F";
          if (value === null || next === unit) { onChange({ value, unit: next }); return; }
          const converted = next === "F" ? toF(value) : toC(value);
          onChange({ value: Math.round(converted * 10) / 10, unit: next });
        }}>
        <option value="C">°C</option>
        <option value="F">°F</option>
      </NativeSelect>
    </span>
  );
}
