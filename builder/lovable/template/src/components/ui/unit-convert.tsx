import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A value shown in the reader's preferred unit, with the stored one intact.
 *
 * THE STORED VALUE NEVER CHANGES. Converting on display and converting the
 * data are different operations, and the second is how a 5 km run becomes
 * 3.1069 mi in the database forever. This takes the canonical value and unit,
 * renders the preference, and hands back nothing.
 *
 * THE CONVERTED VALUE IS ROUNDED TO THE PRECISION OF THE INPUT. 5 km is
 * "about 3.1 mi", not "3.106856 mi" — carrying the conversion factor's digits
 * presents false precision the measurement never had.
 *
 * THE ORIGINAL IS IN THE TITLE, so hovering answers "what was it actually" —
 * and in the accessible name, because "3.1 miles, originally 5 kilometres"
 * settles what a listener would otherwise have to guess.
 *
 * The registry is deliberately small and exact: distance, weight, temperature.
 * Currency is NOT here — it needs a dated rate, which is data, not arithmetic.
 */
type Rule = { to: string; factor?: number; fn?: (n: number) => number; spoken: [string, string] };
const RULES: Record<string, Record<string, Rule>> = {
  km: { mi: { to: "mi", factor: 0.621371, spoken: ["kilometres", "miles"] } },
  mi: { km: { to: "km", factor: 1.609344, spoken: ["miles", "kilometres"] } },
  kg: { lb: { to: "lb", factor: 2.204623, spoken: ["kilograms", "pounds"] } },
  lb: { kg: { to: "kg", factor: 0.453592, spoken: ["pounds", "kilograms"] } },
  cm: { in: { to: "in", factor: 0.393701, spoken: ["centimetres", "inches"] } },
  in: { cm: { to: "cm", factor: 2.54, spoken: ["inches", "centimetres"] } },
  c: { f: { to: "f", fn: (n) => n * 9 / 5 + 32, spoken: ["Celsius", "Fahrenheit"] } },
  f: { c: { to: "c", fn: (n) => (n - 32) * 5 / 9, spoken: ["Fahrenheit", "Celsius"] } },
};
const SYMBOL: Record<string, string> = { km: "km", mi: "mi", kg: "kg", lb: "lb", cm: "cm", in: "in", c: "°C", f: "°F" };

function decimalsOf(n: number) {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function convert(value: number, from: string, to: string): number | null {
  if (from === to) return value;
  const rule = RULES[from]?.[to];
  if (!rule) return null;
  const raw = rule.fn ? rule.fn(value) : value * (rule.factor ?? 1);
  // Round to the input's precision plus one place: no invented digits.
  const places = Math.min(3, decimalsOf(value) + 1);
  return Number(raw.toFixed(places));
}

export function UnitConvert({ value, unit, show, className }: {
  value: number;
  unit: string;
  show?: string;
  className?: string;
}) {
  const target = show && show !== unit ? show : null;
  const converted = target ? convert(value, unit, target) : null;
  const rule = target ? RULES[unit]?.[target] : null;

  if (converted == null || !rule) {
    return <span data-slot="unit-convert" className={cn("tabular-nums", className)}>{value.toLocaleString()} {SYMBOL[unit] ?? unit}</span>;
  }
  return (
    <span
      className={cn("tabular-nums", className)}
      title={`${value.toLocaleString()} ${SYMBOL[unit] ?? unit} exactly`}
    >
      <span aria-hidden>{converted.toLocaleString()} {SYMBOL[target!] ?? target}</span>
      <span className="sr-only">
        {converted.toLocaleString()} {rule.spoken[1]}, originally {value.toLocaleString()} {rule.spoken[0]}
      </span>
    </span>
  );
}
