import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * "Within X of here" — a distance, as steps rather than a free slider.
 *
 * STEPS, NOT A CONTINUOUS SLIDER. Nobody wants 7.3 miles. The real choices are
 * walking distance, across town, and the whole region — four or five values —
 * and a slider makes somebody aim at a number they do not care about while
 * firing a query on every pixel of the drag.
 *
 * THE STEPS DIFFER BY UNIT AND THAT IS NOT COSMETIC. 1, 2, 5, 10, 25 miles are
 * round numbers; their kilometre conversions are 1.6, 3.2, 8 — so a single set
 * of numbers converted on the fly gives one unit ugly steps. Each unit gets
 * its own.
 *
 * "ANYWHERE" IS AN OPTION. A radius filter with no way off traps somebody whose
 * search has no results near them into guessing which step is large enough.
 *
 * `onChange` HANDS BACK BOTH the distance and the unit, because a number with
 * no unit is the bug that turns 25 miles into 25 kilometres somewhere down the
 * stack.
 */
const STEPS: Record<string, number[]> = {
  km: [1, 2, 5, 10, 25, 50],
  mi: [1, 2, 5, 10, 25, 50],
};

export function RadiusInput({ value, unit = "km", onChange, units = ["km", "mi"], anywhereLabel = "Anywhere", id, label = "Within", className }: {
  /** null means no distance limit. */
  value: number | null;
  unit?: string;
  onChange: (next: { value: number | null; unit: string }) => void;
  units?: string[];
  anywhereLabel?: string;
  id?: string;
  label?: string;
  className?: string;
}) {
  const base = id ?? "radius";
  const steps = STEPS[unit] ?? STEPS.km;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 text-sm", className)}>
      <label htmlFor={`${base}-d`} className="text-muted-foreground">{label}</label>
      <NativeSelect id={`${base}-d`} className="h-9 w-auto text-sm" value={value === null ? "" : String(value)}
        onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value), unit })}>
        <option value="">{anywhereLabel}</option>
        {steps.map((s) => <option key={s} value={s}>{s}</option>)}
      </NativeSelect>
      {value !== null && (
        <NativeSelect aria-label="Distance unit" className="h-9 w-auto text-sm" value={unit}
          onChange={(e) => {
            const next = e.target.value;
            const nextSteps = STEPS[next] ?? STEPS.km;
            const i = steps.indexOf(value);
            onChange({ value: nextSteps[i] ?? nextSteps[0], unit: next });
          }}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </NativeSelect>
      )}
    </span>
  );
}
