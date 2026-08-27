import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A volume, with the gallon problem named rather than ignored.
 *
 * THE HAZARD: a US gallon is 3.785 litres and an imperial gallon is 4.546 — a
 * 20% difference. A unit list offering a bare "gal" is wrong for one set of
 * readers whichever value it picks, and nothing on screen reveals which was
 * meant. So the options are spelled out, "US gal" and "UK gal", and the same
 * applies to pints and fluid ounces, which differ for the same reason.
 *
 * That is the entire justification for this being its own component rather than
 * a unit table handed to `unit-input`: the table is the domain knowledge, and
 * getting it wrong is invisible.
 *
 * Factors are against litres and conversion happens on unit change, rounded to
 * six significant figures — enough to round-trip, short of inventing precision
 * the reader never entered.
 */
const PER_L: Record<string, number> = {
  "ml": 1000, "l": 1, "US gal": 0.264172, "UK gal": 0.219969,
  "US pt": 2.11338, "UK pt": 1.75975, "US fl oz": 33.814, "UK fl oz": 35.1951,
};

/** Convert a volume between the units this field offers. */
export function convertCapacity(value: number, from: string, to: string): number | null {
  const a = PER_L[from], b = PER_L[to];
  if (!a || !b) return null;
  return (value / a) * b;
}

export function CapacityInput({ value, unit, onChange, units = ["ml", "l", "US gal", "UK gal"], id, className }: {
  value: number | null;
  unit: string;
  onChange: (next: { value: number | null; unit: string }) => void;
  units?: string[];
  id?: string;
  className?: string;
}) {
  return (
    <span data-slot="capacity-input" className={cn("inline-flex items-stretch gap-1.5", className)}>
      <input id={id} type="number" inputMode="decimal" step="any" min={0} value={value ?? ""}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value), unit })}
        className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <NativeSelect value={unit} aria-label="Volume unit" className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = e.target.value;
          const c = value === null ? null : convertCapacity(value, unit, next);
          onChange({ value: c === null ? value : Number(c.toPrecision(6)), unit: next });
        }}>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </NativeSelect>
    </span>
  );
}
