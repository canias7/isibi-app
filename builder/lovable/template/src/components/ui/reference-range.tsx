import { cn } from "@/lib/utils";
/**
 * The range a result is judged against — and who it applies to.
 *
 * A REFERENCE RANGE IS POPULATION-SPECIFIC AND THE POPULATION IS NAMED. Ranges
 * differ by age, sex, pregnancy, ancestry and assay, and a value judged against
 * the wrong one produces a confident, wrong abnormal — which is how healthy
 * people are investigated and unwell ones are reassured.
 *
 * THE METHOD IS PART OF THE RANGE. Two laboratories measuring the same analyte
 * by different assays have genuinely different ranges, so a result cannot be
 * compared across labs by number alone. Saying so prevents the commonest
 * misreading of a series.
 *
 * "WITHIN RANGE" IS NOT "NORMAL FOR YOU". A range is where 95% of a reference
 * population sits, which means one in twenty healthy people falls outside it,
 * and a personal trend beats a population range for anyone with prior results.
 *
 * A RANGE THAT IS AGE-DEPENDENT SAYS SO EXPLICITLY, because the single most
 * common error is applying an adult range to a child.
 */
export function ReferenceRange({ analyte, low, high, unit, appliesTo, method, ageDependent, note, value, className }: {
  analyte?: string;
  low?: number;
  high?: number;
  unit?: string;
  /** "adult women, not pregnant". */
  appliesTo?: string;
  /** The assay — ranges are not transferable between methods. */
  method?: string;
  ageDependent?: boolean;
  note?: string;
  /** The measured value, where the caller wants the comparison drawn. */
  value?: number;
  className?: string;
}) {
  const u = unit ? ` ${unit}` : "";
  const out = value !== undefined && ((low !== undefined && value < low) || (high !== undefined && value > high));
  return (
    <div data-slot="reference-range" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {analyte && <span>{analyte} </span>}
        <span className={cn("tabular-nums", out && "font-medium")}>
          {value !== undefined ? `${value}${u} · ` : ""}
          {low !== undefined && high !== undefined
            ? `range ${low}–${high}${u}`
            : low !== undefined
              ? `range above ${low}${u}`
              : high !== undefined
                ? `range below ${high}${u}`
                : "no range set"}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {appliesTo ? `Applies to ${appliesTo}` : "The population this range applies to is not stated"}
        {method && ` · measured by ${method}`}
      </p>
      {ageDependent && <p className="text-xs font-medium">This range changes with age — check it matches.</p>}
      {method && (
        <p className="text-xs text-muted-foreground">
          Ranges are not transferable between laboratories using different assays.
        </p>
      )}
      {note && <p className="text-xs">{note}</p>}
    </div>
  );
}
