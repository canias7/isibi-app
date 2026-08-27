import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Length × width × height, with one unit for all three.
 *
 * ONE UNIT, NOT THREE. Nobody measures a parcel in centimetres by metres by
 * inches, and offering a unit per axis creates a combination that is always a
 * mistake — then makes every downstream volume calculation carry three
 * conversions.
 *
 * The three fields are labelled, not placeheld. "L", "W", "H" as placeholder
 * text disappears the moment somebody types, so anyone checking their own work
 * has to clear a field to find out which one it was — and placeholder-only
 * labelling is invisible to a screen reader from the start.
 *
 * The × between fields is `aria-hidden` decoration; the labels carry the
 * meaning.
 *
 * `depth` is offered as a name for the third axis because a parcel has a
 * height and a shelf has a depth, and forcing one word on both makes half the
 * forms read wrongly.
 */
export type Dimensions = { l: number | null; w: number | null; h: number | null; unit: string };

export function DimensionInput({ value, units = ["cm", "in", "m"], onChange, thirdLabel = "Height", id, className }: {
  value: Dimensions;
  units?: string[];
  onChange: (next: Dimensions) => void;
  /** "Height" or "Depth". */
  thirdLabel?: string;
  id?: string;
  className?: string;
}) {
  const base = id ?? "dim";
  const num = (v: string) => (v === "" ? null : Number(v));
  const field = (key: "l" | "w" | "h", label: string) => (
    <span className="flex flex-col gap-1">
      <label htmlFor={`${base}-${key}`} className="text-xs text-muted-foreground">{label}</label>
      <input id={`${base}-${key}`} type="number" inputMode="decimal" step="any" min={0}
        value={value[key] ?? ""}
        onChange={(e) => onChange({ ...value, [key]: num(e.target.value) })}
        className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
    </span>
  );

  return (
    <span data-slot="dimension-input" className={cn("inline-flex flex-wrap items-end gap-2", className)}>
      {field("l", "Length")}
      <span aria-hidden className="pb-2 text-muted-foreground">×</span>
      {field("w", "Width")}
      <span aria-hidden className="pb-2 text-muted-foreground">×</span>
      {field("h", thirdLabel)}
      <span className="flex flex-col gap-1">
        <label htmlFor={`${base}-u`} className="text-xs text-muted-foreground">Unit</label>
        <NativeSelect id={`${base}-u`} value={value.unit} className="h-9 w-auto text-sm"
          onChange={(e) => onChange({ ...value, unit: e.target.value })}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </NativeSelect>
      </span>
    </span>
  );
}
