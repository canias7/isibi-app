import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Which field goes where, between two systems.
 *
 * UNMAPPED REQUIRED FIELDS ARE COUNTED AT THE TOP. A mapping screen is thirty
 * rows of dropdowns, and the two that matter are the ones nothing feeds — miss
 * one and every record fails at import with an error naming a field the person
 * never saw. The count is the whole navigation aid.
 *
 * "DO NOT IMPORT" IS AN EXPLICIT CHOICE, not an empty select. Left blank, an
 * unmapped field is ambiguous between deliberate and forgotten, and the
 * required-count above cannot distinguish them either.
 *
 * TYPE MISMATCHES ARE FLAGGED ON THE ROW. Mapping a text field onto a date is
 * accepted by every mapping UI and fails on the first record; saying so here
 * costs a line and saves a failed import.
 *
 * A `<table>` WITH REAL HEADERS, so a screen reader announces "Their field,
 * Invoice date; Our field, combobox" rather than a run of unlabelled selects.
 */
export type MappingRow = {
  id: string;
  /** Their field. */
  source: string;
  sourceType?: string;
  /** Our field id, or "" for skip. */
  target: string;
  required?: boolean;
  /** Set when the chosen target's type does not match. */
  mismatch?: string;
};

export function FieldMapping({ rows, targets, onChange, skipLabel = "Do not import", className }: {
  rows: MappingRow[];
  targets: { id: string; label: string; type?: string }[];
  onChange: (id: string, target: string) => void;
  skipLabel?: string;
  className?: string;
}) {
  const missing = rows.filter((r) => r.required && !r.target);
  return (
    <div data-slot="field-mapping" className={cn("space-y-2", className)}>
      <p className="text-sm">
        {missing.length === 0
          ? <span className="text-muted-foreground">Everything required is mapped.</span>
          : <>
              <span className="font-medium tabular-nums">{missing.length}</span> required{" "}
              {missing.length === 1 ? "field is" : "fields are"} not mapped —{" "}
              <span className="text-muted-foreground">{missing.map((m) => m.source).join(", ")}</span>
            </>}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="px-2 py-1 text-start font-normal">Their field</th>
            <th scope="col" className="px-2 py-1 text-start font-normal">Goes to</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="px-2 py-1.5 text-start font-normal">
                {r.source}
                {r.required && <span className="ms-1.5 text-xs text-muted-foreground">required</span>}
                {r.sourceType && <span className="block text-xs text-muted-foreground">{r.sourceType}</span>}
              </th>
              <td className="px-2 py-1.5">
                <NativeSelect aria-label={`Where ${r.source} goes`} value={r.target} className="h-8 text-sm"
                  onChange={(e) => onChange(r.id, e.target.value)}>
                  <option value="">{skipLabel}</option>
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </NativeSelect>
                {r.mismatch && <span className="mt-0.5 block text-xs font-medium">{r.mismatch}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
