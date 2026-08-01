import { cn } from "@/lib/utils";
/**
 * Comfortable, or as many rows as will fit.
 *
 * THE CHOICE PERSISTS is the caller's job; what belongs here is that it is a
 * real `radiogroup` with three named steps rather than a slider. Density is not
 * a continuum anybody wants to tune — it is "I want to see more" versus "I want
 * to read it".
 *
 * TOUCH TARGETS ARE THE LIMIT. The compact setting still has to be tappable, so
 * the smallest row height offered is not the smallest that fits — a table that
 * becomes unusable on a phone at its densest is a setting that should not exist.
 *
 * The classes are returned to the caller rather than applied here, because the
 * table is theirs; this is the control, not the table.
 */
export const DENSITY_CLASS = {
  compact: "[&_td]:py-1 [&_th]:py-1 text-xs",
  normal: "[&_td]:py-2 [&_th]:py-2 text-sm",
  comfortable: "[&_td]:py-3.5 [&_th]:py-3.5 text-sm",
} as const;

export type Density = keyof typeof DENSITY_CLASS;

export function TableDensity({ value, onChange, className }: {
  value: Density;
  onChange: (d: Density) => void;
  className?: string;
}) {
  const steps: { key: Density; label: string }[] = [
    { key: "compact", label: "Compact" },
    { key: "normal", label: "Normal" },
    { key: "comfortable", label: "Comfortable" },
  ];
  return (
    <div role="radiogroup" aria-label="Row height"
      className={cn("inline-flex gap-1 rounded-md border border-border p-1", className)}>
      {steps.map((s) => (
        <button key={s.key} type="button" role="radio" aria-checked={value === s.key}
          onClick={() => onChange(s.key)}
          className={cn("cursor-pointer rounded px-2.5 py-1 text-xs",
            value === s.key ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
