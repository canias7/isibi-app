import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Which units to SHOW — with a live example, because the example is the
 * setting.
 *
 * EACH CHOICE PRINTS AN EXAMPLE VALUE IN THAT UNIT ("3.1 mi" / "5 km").
 * Unit names are the one place abbreviations genuinely confuse (is "mi"
 * miles or minutes?); a worked example is unambiguous in every language.
 *
 * THE STORED VALUE NEVER CHANGES — the unit-convert contract, restated here
 * because this is the switch people fear: changing the display unit must
 * not rewrite the data, and the caption says so.
 *
 * A segmented two-way control per unit kind, real radios underneath. This
 * component is the PREFERENCE; rendering converted values elsewhere is
 * unit-convert's job.
 */
export function UnitPreference({ label, options, value, onChange, note, className }: {
  label: React.ReactNode;
  options: { key: string; label: string; example: string }[];
  value?: string;
  onChange: (v: string) => void;
  note?: React.ReactNode;
  className?: string;
}) {
  const name = React.useId();
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex overflow-hidden rounded-md border border-border">
        {options.map((o) => {
          const on = value === o.key;
          return (
            <label key={o.key}
              className={cn("flex flex-1 cursor-pointer flex-col items-center gap-0.5 px-3 py-1.5 text-center",
                on ? "bg-foreground text-background" : "hover:bg-muted",
                "border-e border-border last:border-e-0",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset")}>
              <input type="radio" name={name} checked={on} onChange={() => onChange(o.key)} className="sr-only" />
              <span className="text-sm font-medium">{o.label}</span>
              <span className={cn("text-[11px] tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>{o.example}</span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {note ?? "Changes how values are shown — nothing stored is rewritten."}
      </p>
    </fieldset>
  );
}
