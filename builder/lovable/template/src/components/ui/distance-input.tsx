import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * A distance, kept honest about precision.
 *
 * THE DETAIL: converting 5 miles to kilometres gives 8.04672, and printing all
 * of it claims a precision nobody measured — somebody who typed "5 miles" meant
 * about five miles, not 8.04672 km. Each unit rounds to what it is plausibly
 * measured in: millimetres and metres whole, kilometres and miles to two
 * places.
 *
 * Yards and feet are included because they are how plenty of trades still quote
 * short distances, and nautical miles because a boatyard, a charter and an
 * airfield all need them and nothing else offers them.
 *
 * Factors are against metres, so every pair converts through one number and
 * there is no table of pairwise rates to get inconsistent.
 */
const PER_M: Record<string, number> = {
  "mm": 1000, "cm": 100, "m": 1, "km": 0.001,
  "in": 39.37008, "ft": 3.28084, "yd": 1.093613, "mi": 0.000621371, "nmi": 0.000539957,
};
const PLACES: Record<string, number> = { mm: 0, cm: 1, m: 2, km: 2, in: 1, ft: 1, yd: 1, mi: 2, nmi: 2 };

/** Convert a distance between the units this field offers. */
export function convertDistance(value: number, from: string, to: string): number | null {
  const a = PER_M[from], b = PER_M[to];
  if (!a || !b) return null;
  return (value / a) * b;
}

export function DistanceInput({ value, unit, onChange, units = ["m", "km", "ft", "mi"], id, className }: {
  value: number | null;
  unit: string;
  onChange: (next: { value: number | null; unit: string }) => void;
  units?: string[];
  id?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-stretch gap-1.5", className)}>
      <input id={id} type="number" inputMode="decimal" step="any" min={0} value={value ?? ""}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value), unit })}
        className="h-9 w-28 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <NativeSelect value={unit} aria-label="Distance unit" className="h-9 w-auto text-sm"
        onChange={(e) => {
          const next = e.target.value;
          const c = value === null ? null : convertDistance(value, unit, next);
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
