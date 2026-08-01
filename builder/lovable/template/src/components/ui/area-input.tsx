import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * An area, with the squared-conversion trap handled.
 *
 * THE HAZARD THIS EXISTS FOR: converting m² to ft² is NOT the metre-to-foot
 * factor. It is that factor SQUARED — 3.28 becomes 10.76 — and using the linear
 * one is the single commonest measurement bug there is, because the number that
 * comes out looks entirely plausible. A generic unit field with a length table
 * gets it wrong every time, silently, by a factor of three.
 *
 * So the factors here are area factors, expressed against square metres, and
 * the conversion is a straight multiply that cannot be got wrong at the call
 * site.
 *
 * Acres and hectares are in the list because land is quoted in them everywhere
 * and a field that only offers m² sends people to a search engine mid-form.
 *
 * `inputMode="decimal"` — a numeric keypad has no decimal point, and 4.5 is a
 * perfectly ordinary area.
 */
const PER_SQM: Record<string, number> = {
  "m²": 1, "ft²": 10.763910417, "km²": 0.000001, "acre": 0.000247105, "ha": 0.0001,
};

/** Convert an area between the units this field offers. */
export function convertArea(value: number, from: string, to: string): number | null {
  const a = PER_SQM[from], b = PER_SQM[to];
  if (!a || !b) return null;
  return (value / a) * b;
}

export function AreaInput({ value, unit, onChange, units = Object.keys(PER_SQM), id, className }: {
  value: number | null;
  unit: string;
  onChange: (next: { value: number | null; unit: string }) => void;
  units?: string[];
  id?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-stretch gap-1.5", className)}>
      <input id={id} type="number" inputMode="decimal" step="any" min={0}
        value={value ?? ""}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value), unit })}
        className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <NativeSelect value={unit} aria-label="Area unit" className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = e.target.value;
          const converted = value === null ? null : convertArea(value, unit, next);
          onChange({ value: converted === null ? value : Number(converted.toPrecision(6)), unit: next });
        }}>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </NativeSelect>
    </span>
  );
}
