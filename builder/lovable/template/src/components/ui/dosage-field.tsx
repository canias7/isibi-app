import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Entering a dose, with the mistakes that kill people made hard to type.
 *
 * A TRAILING ZERO IS REFUSED. "1.0mg" misread as 10mg is a tenfold overdose and
 * one of the oldest documented prescribing errors there is; the field says so
 * rather than accepting it quietly.
 *
 * A LEADING DECIMAL POINT IS REFUSED FOR THE SAME REASON. ".5mg" read as 5mg is
 * the same error in the other direction — the zero in "0.5mg" is what makes the
 * point visible.
 *
 * THE UNIT IS A SEPARATE CONTROL, never typed. "u" written for units has been
 * read as a zero more than once, and micrograms abbreviated by hand is the
 * other classic. A picker cannot produce either.
 *
 * A DOSE OUTSIDE THE USUAL RANGE IS QUERIED, NOT BLOCKED. Unusual doses are
 * prescribed deliberately every day, and a field that refuses them sends the
 * prescriber somewhere with no checking at all.
 */
export function DosageField({ value, unit, units = ["mg", "micrograms", "ml", "units"], onValueChange, onUnitChange, usualMin, usualMax, label = "Dose", className }: {
  value: string;
  unit: string;
  units?: string[];
  onValueChange?: (v: string) => void;
  onUnitChange?: (u: string) => void;
  /** Queried, never blocked. */
  usualMin?: number;
  usualMax?: number;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const trailingZero = /^\d+\.\d*0$/.test(value);
  const bareDecimal = /^\.\d+$/.test(value);
  const n = Number(value);
  const outOfRange =
    value.trim() !== "" &&
    Number.isFinite(n) &&
    ((usualMin !== undefined && n < usualMin) || (usualMax !== undefined && n > usualMax));
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums"
        />
        <select
          value={unit}
          onChange={(e) => onUnitChange?.(e.target.value)}
          aria-label="Unit"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {trailingZero && (
        <p className="text-xs font-medium">
          Drop the trailing zero. "{value}" is read as {value.replace(/\.\d*0$/, "")}0 often enough that it is a rule.
        </p>
      )}
      {bareDecimal && (
        <p className="text-xs font-medium">
          Write it as 0{value}. A decimal point with nothing before it gets read as a whole number.
        </p>
      )}
      {outOfRange && (
        <p className="text-xs">
          That is outside the usual{" "}
          <span className="tabular-nums">
            {usualMin ?? "?"}–{usualMax ?? "?"} {unit}
          </span>
          . Deliberate doses go outside it every day — this is a question, not a refusal.
        </p>
      )}
    </div>
  );
}
