import { cn } from "@/lib/utils";
/**
 * A pair of bounds — from and to — that cannot be the wrong way round.
 *
 * IT NORMALISES INSTEAD OF VALIDATING. Typing the larger number first is a
 * thing people do constantly, and an error message telling somebody their two
 * perfectly good numbers are in the wrong order is pedantry about typing order.
 * The pair is sorted on the way out, so the caller always receives min ≤ max.
 *
 * BOTH FIELDS STAY INDEPENDENTLY CLEARABLE, and an open-ended bound is a real
 * answer: "from £50" with no ceiling, "up to 20kg" with no floor. Forcing both
 * makes half the filters in the world unexpressible, which is why the value is
 * `null` rather than 0.
 *
 * The two inputs are separately labelled rather than placeheld — a placeholder
 * vanishes the moment somebody types, so anyone checking their own work has to
 * clear a box to find out which end it was.
 */
export function MinMaxField({ min, max, onChange, unit, label = "Range", id, step = "any", className }: {
  min: number | null;
  max: number | null;
  /** Always receives min <= max. */
  onChange: (next: { min: number | null; max: number | null }) => void;
  unit?: string;
  label?: string;
  id?: string;
  step?: string | number;
  className?: string;
}) {
  const base = id ?? "minmax";
  const num = (v: string) => (v === "" ? null : Number(v));
  const emit = (a: number | null, b: number | null) => {
    if (a !== null && b !== null && a > b) onChange({ min: b, max: a });
    else onChange({ min: a, max: b });
  };

  return (
    <fieldset data-slot="min-max-field" className={cn("flex flex-wrap items-end gap-2", className)}>
      <legend className="sr-only">{label}</legend>
      <span className="flex flex-col gap-1">
        <label htmlFor={`${base}-min`} className="text-xs text-muted-foreground">From</label>
        <input id={`${base}-min`} type="number" inputMode="decimal" step={step} value={min ?? ""}
          onChange={(e) => emit(num(e.target.value), max)}
          className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </span>
      <span className="flex flex-col gap-1">
        <label htmlFor={`${base}-max`} className="text-xs text-muted-foreground">To</label>
        <input id={`${base}-max`} type="number" inputMode="decimal" step={step} value={max ?? ""}
          onChange={(e) => emit(min, num(e.target.value))}
          className="h-9 w-24 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </span>
      {unit && <span className="pb-2 text-sm text-muted-foreground">{unit}</span>}
    </fieldset>
  );
}
