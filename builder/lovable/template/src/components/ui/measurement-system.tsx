import { cn } from "@/lib/utils";
/**
 * Metric or imperial — a preference, kept apart from language.
 *
 * IT IS NOT THE SAME CHOICE AS LANGUAGE, which is why it is its own control.
 * British English wants miles and kilograms together; an American scientist
 * wants metric in an American interface. Deriving units from the locale gets
 * both wrong, and it is the commonest shortcut in this area.
 *
 * IT SHOWS WHAT CHANGES, with real examples. "Imperial" is abstract; "miles,
 * pounds, °F" is a choice somebody can check against what they expect — and it
 * exposes the mixed systems people actually use.
 *
 * MIXED IS OFFERED WHERE THE CALLER SUPPORTS IT, because the honest British
 * answer is miles for distance and Celsius for temperature, and forcing one
 * system makes a product feel foreign to a very large market.
 *
 * A REAL RADIO GROUP with the examples inside each label, so a screen reader
 * hears the consequence with the option rather than as loose text nearby.
 */
export type MeasurementOption = { id: string; label: string; examples: string };

const DEFAULTS: MeasurementOption[] = [
  { id: "metric", label: "Metric", examples: "kilometres, kilograms, °C" },
  { id: "imperial", label: "Imperial", examples: "miles, pounds, °F" },
];

export function MeasurementSystem({ value, onChange, options = DEFAULTS, name = "measurement", legend = "Units", className }: {
  value: string;
  onChange: (id: string) => void;
  options?: MeasurementOption[];
  name?: string;
  legend?: string;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.map((o) => (
        <label key={o.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="radio" name={name} value={o.id} checked={value === o.id}
            onChange={() => onChange(o.id)} className="mt-0.5 size-4 accent-foreground" />
          <span className="min-w-0">
            <span className="block">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.examples}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
