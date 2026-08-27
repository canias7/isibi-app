import { cn } from "@/lib/utils";
/**
 * What each field in a dataset means — including how missing is coded.
 *
 * THE MISSING-VALUE CODE IS THE FIELD PEOPLE FORGET AND IT RUINS ANALYSES. A
 * column using −99 or 999 for "not asked" produces a mean that is silently
 * catastrophic, and the person analysing it three years later has no way to
 * know. It is a first-class field here.
 *
 * CATEGORICAL LEVELS ARE ENUMERATED WITH THEIR CODES. "1 = never, 2 = rarely"
 * is the difference between a reproducible analysis and a guess, and the
 * mapping is exactly what gets lost when a study ends.
 *
 * UNITS ARE MANDATORY FOR ANYTHING NUMERIC and their absence is called out.
 * Weight in kilograms and pounds look identical in a column of numbers, and
 * the most expensive data errors on record are unit errors.
 *
 * COLLECTED-BY AND DERIVED FIELDS ARE DISTINGUISHED, because a derived column
 * recomputed differently later will not match, and treating it as raw data
 * hides that its definition is a choice somebody made.
 */
export type FieldSpec = {
  id: string;
  name: string;
  type: "number" | "text" | "date" | "category" | "boolean";
  unit?: string;
  /** How absence is encoded — the field that ruins analyses. */
  missingCode?: string;
  /** "1 = never, 2 = rarely". */
  levels?: string;
  derived?: string;
  note?: string;
};

export function DataDictionary({ fields, className }: { fields: FieldSpec[]; className?: string }) {
  const unitless = fields.filter((f) => f.type === "number" && !f.unit);
  const uncoded = fields.filter((f) => !f.missingCode);
  return (
    <div data-slot="data-dictionary" className={cn("space-y-1.5", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {fields.map((f) => (
          <li key={f.id} className="space-y-0.5 px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <code className="min-w-0 flex-1 font-mono text-xs">{f.name}</code>
              <span className="shrink-0 text-xs text-muted-foreground">
                {f.type}{f.unit ? ` · ${f.unit}` : ""}
              </span>
            </p>
            {f.levels && <p className="text-xs text-muted-foreground">{f.levels}</p>}
            {f.derived && <p className="text-xs">Derived: {f.derived}</p>}
            <p className={cn("text-xs", f.missingCode ? "text-muted-foreground" : "font-medium")}>
              {f.missingCode
                ? `Missing is coded ${f.missingCode}`
                : "No missing-value code recorded"}
            </p>
            {f.type === "number" && !f.unit && (
              <p className="text-xs font-medium">No unit — this number cannot be interpreted.</p>
            )}
            {f.note && <p className="text-xs text-muted-foreground">{f.note}</p>}
          </li>
        ))}
      </ul>
      {(unitless.length > 0 || uncoded.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {unitless.length > 0 && `${unitless.length} numeric ${unitless.length === 1 ? "field has" : "fields have"} no unit. `}
          {uncoded.length > 0 && `${uncoded.length} ${uncoded.length === 1 ? "field has" : "fields have"} no missing-value code.`}
        </p>
      )}
    </div>
  );
}
