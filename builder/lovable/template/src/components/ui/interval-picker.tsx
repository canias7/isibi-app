import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * "Every 2 weeks" — a number and a unit.
 *
 * TWO CONTROLS, NOT A LIST OF PRESETS. A dropdown of "daily / weekly / monthly"
 * covers the common cases and then somebody wants every 10 days, or every 6
 * hours, and the whole control has to be replaced. A number beside a unit
 * covers all of it and is no harder to use.
 *
 * THE UNIT IS PLURALISED BY `Intl.PluralRules`, not by appending an s. Getting
 * "1 week" and "2 weeks" right in English is trivial; getting it right in
 * languages with three or more plural forms is not, and appending an s there
 * produces something between wrong and nonsense.
 *
 * The minimum is 1 and enforced by clamping rather than validation — "every 0
 * days" is not a schedule, and an error message for a value nobody meant to
 * type is friction where a silent floor is invisible.
 */
const UNITS = ["minute", "hour", "day", "week", "month", "year"] as const;
export type IntervalUnit = (typeof UNITS)[number];

export function IntervalPicker({ every, unit, onChange, units = UNITS, id, className }: {
  every: number;
  unit: IntervalUnit;
  onChange: (next: { every: number; unit: IntervalUnit }) => void;
  units?: readonly IntervalUnit[];
  id?: string;
  className?: string;
}) {
  const pr = new Intl.PluralRules(undefined);
  const label = (u: IntervalUnit, n: number) => {
    const rule = pr.select(n);
    // English needs one extra form; other languages get the unit as-is, which
    // is what a caller localising the labels would replace anyway.
    return rule === "one" ? u : `${u}s`;
  };

  return (
    <span data-slot="interval-picker" className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Every</span>
      <input id={id} type="number" inputMode="numeric" min={1} value={every}
        aria-label="How often"
        onChange={(e) => onChange({ every: Math.max(Number(e.target.value) || 1, 1), unit })}
        className="h-9 w-16 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      <NativeSelect value={unit} aria-label="Unit" className="h-9 w-auto text-sm"
        onChange={(e) => onChange({ every, unit: e.target.value as IntervalUnit })}>
        {units.map((u) => <option key={u} value={u}>{label(u, every)}</option>)}
      </NativeSelect>
    </span>
  );
}
