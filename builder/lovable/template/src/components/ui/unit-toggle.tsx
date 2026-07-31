import { cn } from "@/lib/utils";
/**
 * Switch what a number is measured in — px/rem, kg/lb, °C/°F.
 *
 * IT CONVERTS THE VALUE rather than just relabelling it. A toggle that
 * changes "20 kg" to "20 lb" is worse than none: it silently rewrites the
 * data instead of the unit, and nothing about the UI says so.
 *
 * `convert` is the caller's, because there is no honest generic conversion —
 * px to rem depends on the root size, currency on today's rate.
 */
export function UnitToggle({ value, unit, units, onChange, convert, className }: {
  value: number; unit: string;
  units: { value: string; label: string }[];
  onChange: (v: { value: number; unit: string }) => void;
  convert?: (value: number, from: string, to: string) => number;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md border border-border p-0.5", className)} role="group">
      {units.map((u) => (
        <button key={u.value} type="button" aria-pressed={u.value === unit}
          onClick={() => u.value !== unit && onChange({
            value: convert ? convert(value, unit, u.value) : value,
            unit: u.value,
          })}
          className={cn("cursor-pointer rounded px-2 py-0.5 text-xs",
            u.value === unit ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
          {u.label}
        </button>
      ))}
    </div>
  );
}
